import { Router } from 'express';
import pool from '../db.js';

const router = Router();

// Pending / in-progress lab orders
router.get('/orders', async (req, res, next) => {
  try {
    const { status } = req.query;
    const statusFilter = status || 'pending';
    const { rows } = await pool.query(
      `SELECT lo.lab_order_id, lo.order_number, lo.ordered_at, lo.priority,
              lo.order_status, lo.specimen_type, lo.collected_at, lo.lis_accession_number,
              p.first_name || ' ' || p.last_name AS patient_name, p.mrn, p.dob,
              a.admission_number, b.bed_number, w.ward_name,
              pr.full_name AS ordering_doctor,
              json_agg(json_build_object(
                'order_test_id', lot.order_test_id,
                'test_code', ltd.test_code,
                'test_name', ltd.test_name,
                'category', ltd.category,
                'specimen_required', ltd.specimen_required,
                'status', lot.individual_status
              ) ORDER BY ltd.test_name) AS tests
       FROM lab_orders lo
       JOIN patients p ON p.patient_id = lo.patient_id
       JOIN admissions a ON a.admission_id = lo.admission_id
       LEFT JOIN beds b ON b.bed_id = a.bed_id
       LEFT JOIN wards w ON w.ward_id = b.ward_id
       JOIN providers pr ON pr.provider_id = lo.ordering_provider_id
       JOIN lab_order_tests lot ON lot.lab_order_id = lo.lab_order_id
       JOIN lab_test_definitions ltd ON ltd.test_definition_id = lot.test_definition_id
       WHERE lo.order_status = $1
       GROUP BY lo.lab_order_id, p.patient_id, a.admission_id, b.bed_id, w.ward_id, pr.provider_id
       ORDER BY
         CASE lo.priority WHEN 'critical' THEN 1 WHEN 'stat' THEN 2 ELSE 3 END,
         lo.ordered_at ASC`,
      [statusFilter]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// Mark specimen collected
router.patch('/orders/:id/collect', async (req, res, next) => {
  try {
    const { collected_by, specimen_type } = req.body;
    await pool.query(
      `UPDATE lab_orders SET
         order_status='collected', collected_at=NOW(),
         collected_by=$1, specimen_type=$2, updated_at=NOW()
       WHERE lab_order_id=$3`,
      [collected_by, specimen_type, req.params.id]
    );
    res.json({ message: 'Specimen marked collected' });
  } catch (err) { next(err); }
});

// Enter results for a test
router.post('/results', async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { order_test_id, lab_order_id, validated_by, numeric_value, text_value,
            unit, reference_range_low, reference_range_high, abnormal_flag, is_critical } = req.body;

    // Insert result
    const { rows: [result] } = await client.query(
      `INSERT INTO lab_results
         (order_test_id, validated_by, numeric_value, text_value, unit,
          reference_range_low, reference_range_high, abnormal_flag, result_status, is_critical)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'final',$9)
       RETURNING *`,
      [order_test_id, validated_by || null, numeric_value || null, text_value || null,
       unit || null, reference_range_low || null, reference_range_high || null,
       abnormal_flag || null, is_critical || false]
    );

    // Mark individual test resulted
    await client.query(
      `UPDATE lab_order_tests SET individual_status='resulted' WHERE order_test_id=$1`,
      [order_test_id]
    );

    // Check if all tests for this order are resulted
    const { rows: [{ pending }] } = await client.query(
      `SELECT COUNT(*) AS pending FROM lab_order_tests
       WHERE lab_order_id=$1 AND individual_status != 'resulted'`,
      [lab_order_id]
    );

    if (parseInt(pending) === 0) {
      await client.query(
        `UPDATE lab_orders SET order_status='resulted', results_received_at=NOW(), updated_at=NOW()
         WHERE lab_order_id=$1`,
        [lab_order_id]
      );
    } else {
      await client.query(
        `UPDATE lab_orders SET order_status='processing', updated_at=NOW() WHERE lab_order_id=$1`,
        [lab_order_id]
      );
    }

    await client.query('COMMIT');
    res.status(201).json(result);
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally { client.release(); }
});

// All lab technicians
router.get('/technicians', async (_req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT provider_id, full_name, provider_code FROM providers
       WHERE role='lab_technician' AND is_active=true ORDER BY full_name`
    );
    res.json(rows);
  } catch (err) { next(err); }
});

export default router;
