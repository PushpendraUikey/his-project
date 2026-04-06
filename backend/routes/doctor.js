import { Router } from 'express';
import pool from '../db.js';

const router = Router();

// Doctor's patient list (active admissions)
router.get('/patients', async (req, res, next) => {
  try {
    const { doctor_id } = req.query;
    let query = `
      SELECT a.admission_id, a.admission_number, a.admitted_at,
             a.chief_complaint, a.diagnosis_primary, a.status,
             p.patient_id, p.first_name || ' ' || p.last_name AS patient_name,
             p.mrn, p.dob, p.gender, p.blood_group,
             b.bed_number, w.ward_name,
             pr.full_name AS attending_doctor,
             (SELECT COUNT(*) FROM doctor_orders do2 WHERE do2.admission_id = a.admission_id AND do2.status='pending') AS pending_orders,
             (SELECT recorded_at FROM vital_signs WHERE admission_id = a.admission_id ORDER BY recorded_at DESC LIMIT 1) AS last_vitals_at
      FROM admissions a
      JOIN patients p ON p.patient_id = a.patient_id
      LEFT JOIN beds b ON b.bed_id = a.bed_id
      LEFT JOIN wards w ON w.ward_id = b.ward_id
      LEFT JOIN providers pr ON pr.provider_id = a.attending_provider_id
      WHERE a.status = 'admitted'`;
    const params = [];
    if (doctor_id) {
      params.push(doctor_id);
      query += ` AND a.attending_provider_id = $${params.length}`;
    }
    query += ' ORDER BY a.admitted_at DESC';
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) { next(err); }
});

// Full patient context for doctor
router.get('/patient/:admissionId', async (req, res, next) => {
  try {
    const id = req.params.admissionId;
    const [admissionRes, vitalsRes, notesRes, ordersRes, labsRes] = await Promise.all([
      pool.query(
        `SELECT a.*, p.first_name||' '||p.last_name AS patient_name,
                p.mrn, p.dob, p.gender, p.blood_group,
                b.bed_number, w.ward_name,
                pr.full_name AS attending_doctor
         FROM admissions a
         JOIN patients p ON p.patient_id=a.patient_id
         LEFT JOIN beds b ON b.bed_id=a.bed_id
         LEFT JOIN wards w ON w.ward_id=b.ward_id
         LEFT JOIN providers pr ON pr.provider_id=a.attending_provider_id
         WHERE a.admission_id=$1`, [id]),
      pool.query(
        `SELECT * FROM vital_signs WHERE admission_id=$1 ORDER BY recorded_at DESC LIMIT 10`, [id]),
      pool.query(
        `SELECT nn.*, pr.full_name AS author FROM nursing_notes nn
         JOIN providers pr ON pr.provider_id=nn.author_id
         WHERE nn.admission_id=$1 ORDER BY noted_at DESC LIMIT 10`, [id]),
      pool.query(
        `SELECT doc.*, pr.full_name AS doctor_name FROM doctor_orders doc
         JOIN providers pr ON pr.provider_id=doc.doctor_id
         WHERE doc.admission_id=$1 ORDER BY doc.created_at DESC`, [id]),
      pool.query(
        `SELECT lo.order_number, lo.ordered_at, lo.order_status, lo.priority,
                json_agg(json_build_object('test_name', ltd.test_name, 'status', lot.individual_status,
                  'result', lr.numeric_value, 'unit', lr.unit, 'flag', lr.abnormal_flag)) AS tests
         FROM lab_orders lo
         JOIN lab_order_tests lot ON lot.lab_order_id=lo.lab_order_id
         JOIN lab_test_definitions ltd ON ltd.test_definition_id=lot.test_definition_id
         LEFT JOIN lab_results lr ON lr.order_test_id=lot.order_test_id
         WHERE lo.admission_id=$1
         GROUP BY lo.lab_order_id ORDER BY lo.ordered_at DESC`, [id]),
    ]);
    if (!admissionRes.rows.length) return res.status(404).json({ error: 'Admission not found' });
    res.json({
      admission: admissionRes.rows[0],
      vitals:    vitalsRes.rows,
      notes:     notesRes.rows,
      orders:    ordersRes.rows,
      labs:      labsRes.rows,
    });
  } catch (err) { next(err); }
});

// Create doctor order
router.post('/orders', async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { admission_id, doctor_id, order_type, notes, tests, priority } = req.body;

    let lab_order_id = null;

    // If lab order, create lab_order + lab_order_tests
    if (order_type === 'lab' && tests?.length) {
      const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const { rows: [{ count }] } = await client.query('SELECT COUNT(*) FROM lab_orders');
      const seq = String(parseInt(count) + 1).padStart(5, '0');
      const order_number = `LAB-${datePart}-${seq}`;

      // Get patient_id from admission
      const { rows: [adm] } = await client.query(
        `SELECT patient_id FROM admissions WHERE admission_id=$1`, [admission_id]
      );

      const { rows: [labOrder] } = await client.query(
        `INSERT INTO lab_orders (order_number, admission_id, patient_id, ordering_provider_id, priority)
         VALUES ($1,$2,$3,$4,$5) RETURNING *`,
        [order_number, admission_id, adm.patient_id, doctor_id, priority || 'routine']
      );
      lab_order_id = labOrder.lab_order_id;

      for (const test_definition_id of tests) {
        await client.query(
          `INSERT INTO lab_order_tests (lab_order_id, test_definition_id) VALUES ($1,$2)`,
          [lab_order_id, test_definition_id]
        );
      }
    }

    const { rows: [order] } = await client.query(
      `INSERT INTO doctor_orders (admission_id, doctor_id, order_type, notes, lab_order_id)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [admission_id, doctor_id, order_type, notes || null, lab_order_id]
    );

    await client.query('COMMIT');
    res.status(201).json(order);
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally { client.release(); }
});

// Available lab tests
router.get('/lab-tests', async (_req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT test_definition_id, test_code, test_name, category, specimen_required, turnaround_hours, requires_fasting
       FROM lab_test_definitions WHERE is_active=true ORDER BY category, test_name`
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// Doctors list
router.get('/doctors', async (_req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT provider_id, full_name, specialty FROM providers WHERE role='doctor' AND is_active=true ORDER BY full_name`
    );
    res.json(rows);
  } catch (err) { next(err); }
});

export default router;
