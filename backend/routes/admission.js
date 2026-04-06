import { Router } from 'express';
import pool from '../db.js';

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

// Active admissions list
router.get('/admissions', async (_req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT a.admission_id, a.admission_number, a.admitted_at,
              a.admission_type, a.status, a.chief_complaint, a.diagnosis_primary,
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

// Admit patient
router.post('/admit', async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { patient_id, bed_id, admitting_provider_id, attending_provider_id,
            admission_type, admission_source, chief_complaint, diagnosis_primary } = req.body;

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

    // Audit log
    await client.query(
      `INSERT INTO adt_audit_log (admission_id, event_type, event_description)
       VALUES ($1,'ADMIT','Patient admitted via admission desk')`,
      [admission.admission_id]
    );

    await client.query('COMMIT');
    res.status(201).json(admission);
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally { client.release(); }
});

// Discharge
router.post('/discharge', async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { admission_id, discharging_provider_id, discharge_disposition,
            discharge_condition, discharge_summary, follow_up_required, follow_up_date } = req.body;

    const { rows: [admission] } = await client.query(
      `SELECT bed_id FROM admissions WHERE admission_id=$1`, [admission_id]
    );

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
        `UPDATE beds SET status='cleaning', status_updated_at=NOW() WHERE bed_id=$1`,
        [admission.bed_id]
      );
    }

    await client.query(
      `INSERT INTO adt_audit_log (admission_id, event_type, event_description)
       VALUES ($1,'DISCHARGE','Patient discharged')`,
      [admission_id]
    );

    await client.query('COMMIT');
    res.json({ message: 'Patient discharged successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally { client.release(); }
});

export default router;
