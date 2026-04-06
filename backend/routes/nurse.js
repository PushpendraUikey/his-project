import { Router } from 'express';
import pool from '../db.js';

const router = Router();

// All active admissions for nurse view
router.get('/admissions', async (_req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT a.admission_id, a.admission_number, a.admitted_at,
              a.chief_complaint, a.diagnosis_primary, a.status,
              p.patient_id, p.first_name || ' ' || p.last_name AS patient_name,
              p.mrn, p.dob, p.gender, p.blood_group,
              b.bed_number, w.ward_name, w.ward_type,
              pr.full_name AS attending_doctor,
              (SELECT recorded_at FROM vital_signs WHERE admission_id = a.admission_id
               ORDER BY recorded_at DESC LIMIT 1) AS last_vitals_at
       FROM admissions a
       JOIN patients p ON p.patient_id = a.patient_id
       LEFT JOIN beds b ON b.bed_id = a.bed_id
       LEFT JOIN wards w ON w.ward_id = b.ward_id
       LEFT JOIN providers pr ON pr.provider_id = a.attending_provider_id
       WHERE a.status = 'admitted'
       ORDER BY w.ward_name, b.bed_number`
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// Vitals for an admission
router.get('/vitals/:admissionId', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT vs.*, pr.full_name AS recorded_by_name
       FROM vital_signs vs
       LEFT JOIN providers pr ON pr.provider_id = vs.recorded_by
       WHERE vs.admission_id = $1
       ORDER BY vs.recorded_at DESC LIMIT 20`,
      [req.params.admissionId]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// Record vitals
router.post('/vitals', async (req, res, next) => {
  try {
    const { admission_id, recorded_by, systolic_bp, diastolic_bp,
            heart_rate, temperature, spo2, respiratory_rate, weight_kg, height_cm } = req.body;
    const { rows: [vital] } = await pool.query(
      `INSERT INTO vital_signs
         (admission_id, recorded_by, systolic_bp, diastolic_bp, heart_rate,
          temperature, spo2, respiratory_rate, weight_kg, height_cm)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [admission_id, recorded_by,
       systolic_bp || null, diastolic_bp || null, heart_rate || null,
       temperature || null, spo2 || null, respiratory_rate || null,
       weight_kg || null, height_cm || null]
    );
    res.status(201).json(vital);
  } catch (err) { next(err); }
});

// Nursing notes for an admission
router.get('/notes/:admissionId', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT nn.*, pr.full_name AS author_name
       FROM nursing_notes nn
       JOIN providers pr ON pr.provider_id = nn.author_id
       WHERE nn.admission_id = $1
       ORDER BY nn.noted_at DESC`,
      [req.params.admissionId]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// Add nursing note
router.post('/notes', async (req, res, next) => {
  try {
    const { admission_id, author_id, note_type, note_content } = req.body;
    const { rows: [note] } = await pool.query(
      `INSERT INTO nursing_notes (admission_id, author_id, note_type, note_content)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [admission_id, author_id, note_type || 'nursing', note_content]
    );
    res.status(201).json(note);
  } catch (err) { next(err); }
});

// Active nurses (providers with role nurse)
router.get('/nurses', async (_req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT provider_id, full_name, provider_code FROM providers
       WHERE role='nurse' AND is_active=true ORDER BY full_name`
    );
    res.json(rows);
  } catch (err) { next(err); }
});

export default router;
