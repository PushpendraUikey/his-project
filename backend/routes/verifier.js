import { Router } from 'express';
import pool from '../db.js';

const router = Router();

// Get order queue for verification (resulted orders)
router.get('/orders', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT lo.lab_order_id, lo.order_number, lo.ordered_at, lo.priority,
              lo.order_status, lo.specimen_type, lo.collected_at, lo.results_received_at,
              p.first_name || ' ' || p.last_name AS patient_name, p.mrn,
              a.admission_number, b.bed_number, w.ward_name,
              pr.full_name AS ordering_doctor,
              json_agg(json_build_object(
                'order_test_id', lot.order_test_id,
                'test_code', lot.loinc_code,
                'test_name', lot.test_name,
                'status', lot.individual_status,
                'machine_id', lot.machine_id,
                'result_numeric', lr.numeric_value,
                'result_text', lr.text_value,
                'unit', lr.unit,
                'ref_low', lr.reference_range_low,
                'ref_high', lr.reference_range_high,
                'flag', lr.abnormal_flag
              ) ORDER BY lot.test_name) AS tests
       FROM lab_orders lo
       JOIN patients p ON p.patient_id = lo.patient_id
       JOIN admissions a ON a.admission_id = lo.admission_id
       LEFT JOIN beds b ON b.bed_id = a.bed_id
       LEFT JOIN wards w ON w.ward_id = b.ward_id
       JOIN providers pr ON pr.provider_id = lo.ordering_provider_id
       JOIN lab_order_tests lot ON lot.lab_order_id = lo.lab_order_id
       LEFT JOIN lab_results lr ON lr.order_test_id = lot.order_test_id
       WHERE lo.order_status = 'resulted' OR lo.order_status = 'verified'
       GROUP BY lo.lab_order_id, p.patient_id, a.admission_id, b.bed_id, w.ward_id, pr.provider_id
       ORDER BY lo.results_received_at DESC`
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// Approve (Verify) order
router.post('/orders/:id/approve', async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const lab_order_id = req.params.id;
    const { verifier_id } = req.body;

    await client.query(
      `UPDATE lab_order_tests SET individual_status='verified', updated_at=NOW() WHERE lab_order_id=$1`,
      [lab_order_id]
    );

    // Update result validated_by flag too
    const { rows: tests } = await client.query(
      `SELECT order_test_id FROM lab_order_tests WHERE lab_order_id=$1`,
      [lab_order_id]
    );

    for (const test of tests) {
      await client.query(
        `UPDATE lab_results SET validated_by=$1, updated_at=NOW() WHERE order_test_id=$2`,
        [verifier_id, test.order_test_id]
      );
    }

    await client.query(
      `UPDATE lab_orders SET order_status='verified', updated_at=NOW() WHERE lab_order_id=$1`,
      [lab_order_id]
    );

    await client.query('COMMIT');
    res.json({ message: 'Order verified successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally { client.release(); }
});

// Reject order back to collected
router.post('/orders/:id/reject', async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const lab_order_id = req.params.id;

    // Get all tests for order
    const { rows: tests } = await client.query(
      `SELECT order_test_id FROM lab_order_tests WHERE lab_order_id=$1`,
      [lab_order_id]
    );

    // Delete results
    for (const test of tests) {
      await client.query(`DELETE FROM lab_results WHERE order_test_id=$1`, [test.order_test_id]);
    }

    // Reset test statuses
    await client.query(
      `UPDATE lab_order_tests SET individual_status='collected', machine_id=NULL, updated_at=NOW() WHERE lab_order_id=$1`,
      [lab_order_id]
    );

    // Reset order status
    await client.query(
      `UPDATE lab_orders SET order_status='collected', results_received_at=NULL, updated_at=NOW() WHERE lab_order_id=$1`,
      [lab_order_id]
    );

    await client.query('COMMIT');
    res.json({ message: 'Order rejected and sent back to processing' });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally { client.release(); }
});

// All verifiers
router.get('/verifiers', async (_req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT provider_id, full_name, provider_code FROM providers
       WHERE role='verifier' AND is_active=true ORDER BY full_name`
    );
    res.json(rows);
  } catch (err) { next(err); }
});

export default router;
