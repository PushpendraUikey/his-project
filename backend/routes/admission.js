import { Router } from 'express';
import pool from '../db.js';
import { sendADTMessage } from '../services/fhir-messaging.js';

const router = Router();

// Available beds
router.get('/beds', async (_req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT b.bed_id, b.bed_number, b.bed_type, b.status,
              w.ward_name, w.ward_code, w.ward_type, w.department
       FROM beds b JOIN wards w ON w.ward_id = b.ward_id
       WHERE b.status = 'available' AND w.is_active = true
       ORDER BY w.ward_name, b.bed_number`
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// All beds with status
router.get('/beds/all', async (_req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT b.bed_id, b.bed_number, b.bed_type, b.status,
              w.ward_name, w.ward_code, w.ward_type,
              a.admission_number,
              p.first_name || ' ' || p.last_name AS patient_name
       FROM beds b
       JOIN wards w ON w.ward_id = b.ward_id
       LEFT JOIN admissions a ON a.bed_id = b.bed_id AND a.status = 'admitted'
       LEFT JOIN patients p ON p.patient_id = a.patient_id
       WHERE w.is_active = true
       ORDER BY w.ward_name, b.bed_number`
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// Active providers (doctors)
router.get('/providers', async (_req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT provider_id, provider_code, full_name, specialty, role
       FROM providers WHERE is_active = true AND role = 'doctor'
       ORDER BY full_name`
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// Active admissions list (ENHANCED with discharge approval fields)
router.get('/admissions', async (_req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT a.admission_id, a.admission_number, a.admitted_at,
              a.admission_type, a.status, a.chief_complaint, a.diagnosis_primary,
              a.discharge_approved, a.discharge_decision,
              p.first_name || ' ' || p.last_name AS patient_name,
              p.mrn, p.dob, p.gender,
              b.bed_number, w.ward_name,
              pr.full_name AS attending_doctor
       FROM admissions a
       JOIN patients p ON p.patient_id = a.patient_id
       LEFT JOIN beds b ON b.bed_id = a.bed_id
       LEFT JOIN wards w ON w.ward_id = b.ward_id
       LEFT JOIN providers pr ON pr.provider_id = a.attending_provider_id
       WHERE a.status = 'admitted'
       ORDER BY a.admitted_at DESC`
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// Admit patient (ENHANCED with emergency ward enforcement)
router.post('/admit', async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { patient_id, bed_id, admitting_provider_id, attending_provider_id,
            admission_type, admission_source, chief_complaint, diagnosis_primary, performed_by } = req.body;

    // FEATURE A: Emergency ward enforcement
    if (admission_type === 'emergency' && bed_id) {
      const { rows: [bed] } = await client.query(
        `SELECT w.ward_type FROM beds b
         JOIN wards w ON w.ward_id = b.ward_id
         WHERE b.bed_id = $1`,
        [bed_id]
      );
      if (!bed || bed.ward_type !== 'emergency') {
        await client.query('ROLLBACK');
        return res.status(400).json({
          error: 'Emergency admissions must be assigned to emergency ward beds'
        });
      }
    }

    // Auto admission number
    const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const { rows: [{ count }] } = await client.query('SELECT COUNT(*) FROM admissions');
    const seq = String(parseInt(count) + 1).padStart(5, '0');
    const admission_number = `ADM-${datePart}-${seq}`;

    const { rows: [admission] } = await client.query(
      `INSERT INTO admissions
         (admission_number, patient_id, bed_id, admitting_provider_id, attending_provider_id,
          admission_type, admission_source, chief_complaint, diagnosis_primary)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [admission_number, patient_id, bed_id || null,
       admitting_provider_id, attending_provider_id || null,
       admission_type, admission_source || null,
       chief_complaint || null, diagnosis_primary || null]
    );

    // Mark bed occupied
    if (bed_id) {
      await client.query(
        `UPDATE beds SET status='occupied', status_updated_at=NOW() WHERE bed_id=$1`,
        [bed_id]
      );
    }

    // Audit log (ENHANCED with performed_by)
    await client.query(
      `INSERT INTO adt_audit_log (admission_id, event_type, event_description, performed_by)
       VALUES ($1,'ADMIT','Patient admitted via admission desk',$2)`,
      [admission.admission_id, performed_by || null]
    );

    await client.query('COMMIT');

    // FHIR: Generate and log ADT_A01 (Admit) message
    try {
      await sendADTMessage(null, admission.admission_id, 'ADMIT', performed_by || admitting_provider_id);
    } catch (fhirErr) {
      console.error('[FHIR] Failed to generate ADT_A01:', fhirErr.message);
      // Non-blocking — admission succeeded, FHIR logging is best-effort
    }

    res.status(201).json(admission);
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally { client.release(); }
});

// Discharge (ENHANCED with doctor approval check)
router.post('/discharge', async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { admission_id, discharging_provider_id, discharge_disposition,
            discharge_condition, discharge_summary, follow_up_required, follow_up_date, performed_by } = req.body;

    // FEATURE B: Doctor approval check
    const { rows: [admission] } = await client.query(
      `SELECT bed_id, discharge_approved FROM admissions WHERE admission_id=$1`,
      [admission_id]
    );

    if (!admission?.discharge_approved) {
      await client.query('ROLLBACK');
      return res.status(403).json({
        error: 'Discharge requires doctor approval. Please request approval from the attending physician.'
      });
    }

    await client.query(
      `INSERT INTO discharges
         (admission_id, discharging_provider_id, discharge_disposition,
          discharge_condition, discharge_summary, follow_up_required, follow_up_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [admission_id, discharging_provider_id, discharge_disposition,
       discharge_condition || null, discharge_summary || null,
       follow_up_required || false, follow_up_date || null]
    );

    await client.query(
      `UPDATE admissions SET status='discharged', updated_at=NOW() WHERE admission_id=$1`,
      [admission_id]
    );

    if (admission?.bed_id) {
      await client.query(
        `UPDATE beds SET status='dirty', status_updated_at=NOW() WHERE bed_id=$1`,
        [admission.bed_id]
      );
    }

    // Audit log (ENHANCED with performed_by)
    await client.query(
      `INSERT INTO adt_audit_log (admission_id, event_type, event_description, performed_by)
       VALUES ($1,'DISCHARGE','Patient discharged',$2)`,
      [admission_id, performed_by || null]
    );

    await client.query('COMMIT');

    // FHIR: Generate and log ADT_A03 (Discharge) message
    try {
      await sendADTMessage(null, admission_id, 'DISCHARGE', performed_by || discharging_provider_id);
    } catch (fhirErr) {
      console.error('[FHIR] Failed to generate ADT_A03:', fhirErr.message);
    }

    res.json({ message: 'Patient discharged successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally { client.release(); }
});

// Internal Transfer (ENHANCED with performed_by in audit log)
router.post('/transfer', async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { admission_id, to_bed_id, reason, ordered_by } = req.body;
    if (!admission_id || !to_bed_id) {
      return res.status(400).json({ error: 'admission_id and to_bed_id required' });
    }

    // Get current bed
    const { rows: [admission] } = await client.query(
      'SELECT bed_id, patient_id FROM admissions WHERE admission_id=$1', [admission_id]
    );

    const from_bed_id = admission?.bed_id;

    // Release old bed
    if (from_bed_id) {
      await client.query(
        `UPDATE beds SET status='dirty', status_updated_at=NOW() WHERE bed_id=$1`,
        [from_bed_id]
      );
    }

    // Occupy new bed
    await client.query(
      `UPDATE beds SET status='occupied', status_updated_at=NOW() WHERE bed_id=$1`,
      [to_bed_id]
    );

    // Update admission bed and reset discharge_approved
    await client.query(
      `UPDATE admissions SET bed_id=$1, transfer_type='internal', discharge_approved=FALSE, discharge_decision=NULL, updated_at=NOW() WHERE admission_id=$2`,
      [to_bed_id, admission_id]
    );

    // Log transfer record
    const { rows: [transfer] } = await client.query(
      `INSERT INTO patient_transfers (admission_id, transfer_type, from_bed_id, to_bed_id, reason, ordered_by, transfer_status, transferred_at)
       VALUES ($1,'internal',$2,$3,$4,$5,'completed',NOW()) RETURNING *`,
      [admission_id, from_bed_id || null, to_bed_id, reason || null, ordered_by || null]
    );

    // ADT audit (ENHANCED with performed_by)
    await client.query(
      `INSERT INTO adt_audit_log (admission_id, event_type, event_description, performed_by)
       VALUES ($1,'TRANSFER','Internal patient transfer to new bed',$2)`,
      [admission_id, ordered_by || null]
    );

    await client.query('COMMIT');

    // FHIR: Generate and log ADT_A02 (Transfer) message
    try {
      await sendADTMessage(null, admission_id, 'TRANSFER', ordered_by);
    } catch (fhirErr) {
      console.error('[FHIR] Failed to generate ADT_A02:', fhirErr.message);
    }

    res.status(201).json({ message: 'Internal transfer completed', transfer });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally { client.release(); }
});

// External Transfer (ENHANCED with performed_by in audit log)
router.post('/external-transfer', async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { admission_id, to_facility_name, to_facility_address, reason, ordered_by } = req.body;
    if (!admission_id || !to_facility_name) {
      return res.status(400).json({ error: 'admission_id and to_facility_name required' });
    }

    const { rows: [admission] } = await client.query(
      'SELECT bed_id FROM admissions WHERE admission_id=$1', [admission_id]
    );

    // Release bed
    if (admission?.bed_id) {
      await client.query(
        `UPDATE beds SET status='dirty', status_updated_at=NOW() WHERE bed_id=$1`,
        [admission.bed_id]
      );
    }

    // Mark admission as transferred
    await client.query(
      `UPDATE admissions SET status='discharged', transfer_type='external',
       transfer_destination=$1, updated_at=NOW() WHERE admission_id=$2`,
      [to_facility_name, admission_id]
    );

    // Log transfer
    const { rows: [transfer] } = await client.query(
      `INSERT INTO patient_transfers (admission_id, transfer_type, from_bed_id, to_facility_name, to_facility_address, reason, ordered_by, transfer_status, transferred_at)
       VALUES ($1,'external',$2,$3,$4,$5,$6,'completed',NOW()) RETURNING *`,
      [admission_id, admission?.bed_id || null, to_facility_name, to_facility_address || null, reason || null, ordered_by || null]
    );

    // ADT audit (ENHANCED with performed_by)
    await client.query(
      `INSERT INTO adt_audit_log (admission_id, event_type, event_description, performed_by)
       VALUES ($1,'TRANSFER','External transfer to ' || $2,$3)`,
      [admission_id, to_facility_name, ordered_by || null]
    );

    await client.query('COMMIT');

    // FHIR: Generate and log ADT_A02 (Transfer) message with external destination
    try {
      await sendADTMessage(null, admission_id, 'TRANSFER', ordered_by, to_facility_name);
    } catch (fhirErr) {
      console.error('[FHIR] Failed to generate ADT_A02 (external):', fhirErr.message);
    }

    res.status(201).json({ message: `External transfer to ${to_facility_name} completed`, transfer });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally { client.release(); }
});

// Fetch transfers for an admission
router.get('/transfers/:admissionId', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT t.*, fb.bed_number AS from_bed, tb.bed_number AS to_bed,
              fw.ward_name AS from_ward, tw.ward_name AS to_ward,
              pr.full_name AS ordered_by_name
       FROM patient_transfers t
       LEFT JOIN beds fb ON fb.bed_id=t.from_bed_id
       LEFT JOIN wards fw ON fw.ward_id=fb.ward_id
       LEFT JOIN beds tb ON tb.bed_id=t.to_bed_id
       LEFT JOIN wards tw ON tw.ward_id=tb.ward_id
       LEFT JOIN providers pr ON pr.provider_id=t.ordered_by
       WHERE t.admission_id=$1
       ORDER BY t.created_at DESC`,
      [req.params.admissionId]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// FEATURE C: Get approval status for a specific admission
router.get('/admissions/:id/approval-status', async (req, res, next) => {
  try {
    const { rows: [approval] } = await pool.query(
      `SELECT a.admission_id, a.discharge_approved, a.discharge_approved_by,
              a.discharge_approved_at, a.discharge_decision, a.discharge_notes,
              pr.full_name AS discharge_approved_by_name
       FROM admissions a
       LEFT JOIN providers pr ON pr.provider_id = a.discharge_approved_by
       WHERE a.admission_id = $1`,
      [req.params.id]
    );

    if (!approval) {
      return res.status(404).json({ error: 'Admission not found' });
    }

    res.json(approval);
  } catch (err) { next(err); }
});

// FEATURE: Manual update of bed status (e.g., dirty to available)
router.patch('/beds/:id/status', async (req, res, next) => {
  try {
    const { status } = req.body;
    await pool.query(
      `UPDATE beds SET status=$1, status_updated_at=NOW() WHERE bed_id=$2`,
      [status, req.params.id]
    );
    res.json({ message: `Bed status updated to ${status}` });
  } catch (err) { next(err); }
});

export default router;
