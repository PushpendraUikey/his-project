import { Router } from 'express';
import pool from '../db.js';

const router = Router();

// Search patients by MRN, name, or phone
router.get('/patients', async (req, res, next) => {
  try {
    const { q } = req.query;
    if (!q) {
      const { rows } = await pool.query(
        `SELECT patient_id, mrn, first_name, last_name, dob, gender, blood_group, phone, email
         FROM patients ORDER BY created_at DESC LIMIT 50`
      );
      return res.json(rows);
    }
    const { rows } = await pool.query(
      `SELECT patient_id, mrn, first_name, last_name, dob, gender, blood_group, phone, email
       FROM patients
       WHERE mrn ILIKE $1 OR first_name ILIKE $1 OR last_name ILIKE $1 OR phone ILIKE $1
       ORDER BY last_name, first_name LIMIT 30`,
      [`%${q}%`]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// Get single patient with insurance
router.get('/patients/:id', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT p.*, 
              json_agg(pi.*) FILTER (WHERE pi.insurance_id IS NOT NULL) AS insurance
       FROM patients p
       LEFT JOIN patient_insurance pi ON pi.patient_id = p.patient_id
       WHERE p.patient_id = $1
       GROUP BY p.patient_id`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Patient not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// Register new patient
router.post('/patients', async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { first_name, last_name, dob, gender, blood_group, national_id,
            phone, email, address, insurance } = req.body;

    // Auto-generate MRN: MRN-YYYYMMDD-XXXX
    const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const { rows: [{ count }] } = await client.query('SELECT COUNT(*) FROM patients');
    const seq = String(parseInt(count) + 1).padStart(4, '0');
    const mrn = `MRN-${datePart}-${seq}`;

    const { rows: [patient] } = await client.query(
      `INSERT INTO patients (mrn, first_name, last_name, dob, gender, blood_group, national_id, phone, email, address)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      [mrn, first_name, last_name, dob, gender, blood_group || null,
       national_id || null, phone || null, email || null,
       address ? JSON.stringify(address) : null]
    );

    if (insurance && insurance.provider_name) {
      await client.query(
        `INSERT INTO patient_insurance (patient_id, provider_name, policy_number, group_number, valid_from, valid_to, is_primary)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [patient.patient_id, insurance.provider_name, insurance.policy_number,
         insurance.group_number || null, insurance.valid_from || null,
         insurance.valid_to || null, true]
      );
    }

    await client.query('COMMIT');
    res.status(201).json(patient);
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally { client.release(); }
});

// Update patient
router.put('/patients/:id', async (req, res, next) => {
  try {
    const { first_name, last_name, dob, gender, blood_group, phone, email, address } = req.body;
    const { rows: [patient] } = await pool.query(
      `UPDATE patients SET first_name=$1,last_name=$2,dob=$3,gender=$4,
       blood_group=$5,phone=$6,email=$7,address=$8,updated_at=NOW()
       WHERE patient_id=$9 RETURNING *`,
      [first_name, last_name, dob, gender, blood_group || null,
       phone || null, email || null,
       address ? JSON.stringify(address) : null, req.params.id]
    );
    if (!patient) return res.status(404).json({ error: 'Patient not found' });
    res.json(patient);
  } catch (err) { next(err); }
});

export default router;
