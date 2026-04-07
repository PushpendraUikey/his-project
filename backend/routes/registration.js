import { Router } from 'express';
import pool from '../db.js';

const router = Router();

// Validation helpers
const validateFirstName = (name) => {
  if (!name || typeof name !== 'string') return false;
  const trimmed = name.trim();
  return trimmed.length >= 1 && trimmed.length <= 100;
};

const validateLastName = (name) => {
  if (!name || typeof name !== 'string') return false;
  const trimmed = name.trim();
  return trimmed.length >= 1 && trimmed.length <= 100;
};

const validateDOB = (dob) => {
  if (!dob || typeof dob !== 'string') return false;
  const date = new Date(dob);
  if (isNaN(date.getTime())) return false;
  // Must be a valid date and <= today
  return date <= new Date();
};

const validateGender = (gender) => {
  if (!gender || typeof gender !== 'string') return false;
  return ['male', 'female', 'other'].includes(gender.toLowerCase());
};

const validatePhone = (phone) => {
  if (!phone || typeof phone !== 'string') return false;
  // Strip spaces, dashes, and other non-digit characters
  const cleaned = phone.replace(/[^\d]/g, '');
  // Must be EXACTLY 10 digits
  return cleaned.length === 10;
};

const cleanPhone = (phone) => {
  if (!phone) return '';
  return phone.replace(/(?!^\+)[^\d]/g, '');
};

const validateAddress = (address) => {
  if (!address || typeof address !== 'object') return false;
  const { line1, city, state, pincode } = address;
  return (
    line1 && typeof line1 === 'string' && line1.trim().length > 0 &&
    city && typeof city === 'string' && city.trim().length > 0 &&
    state && typeof state === 'string' && state.trim().length > 0 &&
    pincode && typeof pincode === 'string' && pincode.trim().length > 0
  );
};

const validateNationalId = (id) => {
  if (!id) return true; // Optional
  if (typeof id !== 'string') return false;
  // Aadhaar: exactly 12 digits
  const cleaned = id.replace(/[^\d]/g, '');
  return cleaned.length === 12;
};

const validateEmail = (email) => {
  if (!email) return true; // Optional
  if (typeof email !== 'string') return false;
  // Basic email format check
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const validateBloodGroup = (bg) => {
  if (!bg) return true; // Optional
  if (typeof bg !== 'string') return false;
  const validGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
  return validGroups.includes(bg.toUpperCase());
};

// Helper to generate MRN
const generateMRN = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `MRN-${year}${month}${day}-${random}`;
};

// Helper to validate patient data
const validatePatientData = (data) => {
  const errors = [];

  if (!validateFirstName(data.first_name)) {
    errors.push('first_name is required and must be 1-100 characters');
  }

  if (!validateLastName(data.last_name)) {
    errors.push('last_name is required and must be 1-100 characters');
  }

  if (!validateDOB(data.dob)) {
    errors.push('dob is required, must be a valid date, and must be <= today');
  }

  if (!validateGender(data.gender)) {
    errors.push('gender is required and must be one of: male, female, other');
  }

  if (!validatePhone(data.phone)) {
    errors.push('phone is required and must be 10 digits (or include +91/91 prefix)');
  }

  if (!validateAddress(data.address)) {
    errors.push('address is required and must have line1, city, state, and pincode');
  }

  if (data.national_id && !validateNationalId(data.national_id)) {
    errors.push('national_id (Aadhaar) must be exactly 12 digits if provided');
  }

  if (data.email && !validateEmail(data.email)) {
    errors.push('email must be in valid format if provided');
  }

  if (data.blood_group && !validateBloodGroup(data.blood_group)) {
    errors.push('blood_group must be one of: A+, A-, B+, B-, AB+, AB-, O+, O- if provided');
  }

  return errors;
};

// GET /patients - Search by MRN, name, phone, or general query q (limit 50)
router.get('/patients', async (req, res) => {
  try {
    const { mrn, name, phone, q, unadmitted } = req.query;
    let query = 'SELECT p.* FROM patients p WHERE 1=1';
    const params = [];

    if (unadmitted === 'true') {
      query += ` AND NOT EXISTS (
        SELECT 1 FROM admissions a 
        WHERE a.patient_id = p.patient_id AND a.status = 'admitted'
      )`;
    }

    if (q) {
      const cleanedPhone = cleanPhone(q);
      query += ' AND (mrn ILIKE $' + (params.length + 1) +
               ' OR first_name ILIKE $' + (params.length + 2) +
               ' OR last_name ILIKE $' + (params.length + 3) +
               ' OR phone LIKE $' + (params.length + 4) + ')';
      params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${cleanedPhone || q}%`);
    } else {
      if (mrn) {
        query += ' AND mrn ILIKE $' + (params.length + 1);
        params.push(`%${mrn}%`);
      }

      if (name) {
        query += ' AND (first_name ILIKE $' + (params.length + 1) + ' OR last_name ILIKE $' + (params.length + 2) + ')';
        params.push(`%${name}%`, `%${name}%`);
      }

      if (phone) {
        const cleanedPhone = cleanPhone(phone);
        query += ' AND phone LIKE $' + (params.length + 1);
        params.push(`%${cleanedPhone}%`);
      }
    }

    query += ' ORDER BY created_at DESC LIMIT 50';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error searching patients:', error);
    res.status(500).json({ error: 'Failed to search patients' });
  }
});

// GET /patients/:id - Get patient with insurance AND version history
router.get('/patients/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const query = `
      SELECT
        p.*,
        COUNT(pv.version_id) as version_count
      FROM patients p
      LEFT JOIN patient_versions pv ON p.patient_id = pv.patient_id
      WHERE p.patient_id = $1
      GROUP BY p.patient_id
    `;

    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching patient:', error);
    res.status(500).json({ error: 'Failed to fetch patient' });
  }
});

// GET /patients/:id/versions - Get all version snapshots for a patient
router.get('/patients/:id/versions', async (req, res) => {
  try {
    const { id } = req.params;

    const query = `
      SELECT *
      FROM patient_versions
      WHERE patient_id = $1
      ORDER BY version DESC
    `;

    const result = await pool.query(query, [id]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching patient versions:', error);
    res.status(500).json({ error: 'Failed to fetch patient versions' });
  }
});

// POST /patients - Register new patient with strong validations
router.post('/patients', async (req, res) => {
  const client = await pool.connect();

  try {
    const {
      first_name,
      last_name,
      dob,
      gender,
      phone,
      address,
      national_id,
      email,
      blood_group,
      insurance,
      created_by
    } = req.body;

    // Validate all required and optional fields
    const validationErrors = validatePatientData({
      first_name,
      last_name,
      dob,
      gender,
      phone,
      address,
      national_id,
      email,
      blood_group
    });

    if (validationErrors.length > 0) {
      return res.status(400).json({ errors: validationErrors });
    }

    await client.query('BEGIN');

    // Generate MRN
    const mrn = generateMRN();

    // Clean phone number
    const cleanedPhone = cleanPhone(phone);

    // Normalize gender
    const normalizedGender = gender.toLowerCase();

    // Insert patient
    const insertQuery = `
      INSERT INTO patients (
        mrn,
        first_name,
        last_name,
        dob,
        gender,
        phone,
        address,
        national_id,
        email,
        blood_group,
        version,
        created_by,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
      RETURNING *
    `;

    const values = [
      mrn,
      first_name.trim(),
      last_name.trim(),
      dob,
      normalizedGender,
      cleanedPhone,
      JSON.stringify(address),
      national_id ? national_id.replace(/[^\d]/g, '') : null,
      email || null,
      blood_group ? blood_group.toUpperCase() : null,
      1,
      created_by || null
    ];

    const result = await client.query(insertQuery, values);
    const newPatient = result.rows[0];

    // Check if insurance data is meaningfully provided
    if (insurance && (insurance.provider_name?.trim() || insurance.policy_number?.trim())) {
      await client.query(`
        INSERT INTO patient_insurance (patient_id, provider_name, policy_number, group_number, valid_from, valid_to)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        newPatient.patient_id,
        insurance.provider_name || 'Unknown',
        insurance.policy_number || 'Unknown',
        insurance.group_number || null,
        insurance.valid_from ? insurance.valid_from : null,
        insurance.valid_to ? insurance.valid_to : null
      ]);
    }

    await client.query('COMMIT');

    res.status(201).json(newPatient);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error registering patient:', error);
    res.status(500).json({ error: 'Failed to register patient' });
  } finally {
    client.release();
  }
});

// PUT /patients/:id - Update patient with versioning
router.put('/patients/:id', async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const {
      first_name,
      last_name,
      dob,
      gender,
      phone,
      address,
      national_id,
      email,
      blood_group,
      insurance,
      updated_by
    } = req.body;

    // Validate all fields
    const validationErrors = validatePatientData({
      first_name,
      last_name,
      dob,
      gender,
      phone,
      address,
      national_id,
      email,
      blood_group
    });

    if (validationErrors.length > 0) {
      return res.status(400).json({ errors: validationErrors });
    }

    await client.query('BEGIN');

    // Fetch current patient to create version snapshot
    const currentPatientQuery = 'SELECT * FROM patients WHERE patient_id = $1';
    const currentPatientResult = await client.query(currentPatientQuery, [id]);

    if (currentPatientResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Patient not found' });
    }

    const currentPatient = currentPatientResult.rows[0];
    const nextVersion = currentPatient.version + 1;

    // Insert version snapshot of current data
    const versionInsertQuery = `
      INSERT INTO patient_versions (
        patient_id,
        version,
        mrn,
        first_name,
        last_name,
        dob,
        gender,
        phone,
        address,
        national_id,
        email,
        blood_group,
        changed_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    `;

    const versionValues = [
      id,
      currentPatient.version,
      currentPatient.mrn,
      currentPatient.first_name,
      currentPatient.last_name,
      currentPatient.dob,
      currentPatient.gender,
      currentPatient.phone,
      currentPatient.address,
      currentPatient.national_id,
      currentPatient.email,
      currentPatient.blood_group,
      updated_by || null
    ];

    await client.query(versionInsertQuery, versionValues);

    // Clean phone number
    const cleanedPhone = cleanPhone(phone);

    // Normalize gender
    const normalizedGender = gender.toLowerCase();

    // Update patient
    const updateQuery = `
      UPDATE patients
      SET
        first_name = $1,
        last_name = $2,
        dob = $3,
        gender = $4,
        phone = $5,
        address = $6,
        national_id = $7,
        email = $8,
        blood_group = $9,
        version = $10,
        updated_by = $11,
        updated_at = NOW()
      WHERE patient_id = $12
      RETURNING *
    `;

    const updateValues = [
      first_name.trim(),
      last_name.trim(),
      dob,
      normalizedGender,
      cleanedPhone,
      JSON.stringify(address),
      national_id ? national_id.replace(/[^\d]/g, '') : null,
      email || null,
      blood_group ? blood_group.toUpperCase() : null,
      nextVersion,
      updated_by || null,
      id
    ];

    const updateResult = await client.query(updateQuery, updateValues);
    const updatedPatient = updateResult.rows[0];

    await client.query('COMMIT');

    res.json(updatedPatient);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating patient:', error);
    res.status(500).json({ error: 'Failed to update patient' });
  } finally {
    client.release();
  }
});

export default router;
