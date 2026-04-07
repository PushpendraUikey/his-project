import { Router } from 'express';
import bcrypt from 'bcrypt';
import pool from '../db.js';

const router = Router();

/**
 * GET /providers - List all providers with pagination
 * Query params: role (filter), is_active (filter), q (search name/code)
 * Returns: provider_id, provider_code, full_name, role, specialty, license_number, is_active, password_must_change, created_at
 */
router.get('/providers', async (req, res) => {
  try {
    const { role, is_active, q, limit = 20, offset = 0 } = req.query;

    let query = `
      SELECT
        provider_id, provider_code, full_name, role, specialty,
        license_number, is_active, password_must_change, created_at
      FROM providers
      WHERE 1=1
    `;
    const params = [];

    // Filter by role
    if (role) {
      query += ` AND role = $${params.length + 1}`;
      params.push(role);
    }

    // Filter by is_active
    if (is_active !== undefined) {
      query += ` AND is_active = $${params.length + 1}`;
      params.push(is_active === 'true');
    }

    // Search by name or code
    if (q) {
      query += ` AND (full_name ILIKE $${params.length + 1} OR provider_code ILIKE $${params.length + 2})`;
      params.push(`%${q}%`);
      params.push(`%${q}%`);
    }

    // Order by created_at DESC
    query += ` ORDER BY created_at DESC`;

    // Pagination
    query += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit, 10));
    params.push(parseInt(offset, 10));

    const result = await pool.query(query, params);

    res.json({
      providers: result.rows,
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
      total: result.rows.length
    });
  } catch (error) {
    console.error('Error fetching providers:', error);
    res.status(500).json({ error: 'Failed to fetch providers' });
  }
});

/**
 * GET /providers/:id - Single provider details with audit log
 */
router.get('/providers/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Fetch provider details
    const providerResult = await pool.query(
      `SELECT
        provider_id, provider_code, full_name, role, specialty,
        license_number, is_active, password_must_change, created_at
       FROM providers
       WHERE provider_id = $1`,
      [id]
    );

    if (providerResult.rows.length === 0) {
      return res.status(404).json({ error: 'Provider not found' });
    }

    const provider = providerResult.rows[0];

    // Fetch audit log entries for this provider
    const auditResult = await pool.query(
      `SELECT
        audit_id, provider_id, action, details, performed_by, created_at
       FROM provider_audit_log
       WHERE provider_id = $1
       ORDER BY created_at DESC`,
      [id]
    );

    res.json({
      provider,
      auditLog: auditResult.rows
    });
  } catch (error) {
    console.error('Error fetching provider details:', error);
    res.status(500).json({ error: 'Failed to fetch provider details' });
  }
});

/**
 * POST /providers/:id/activate - Activate a user
 */
router.post('/providers/:id/activate', async (req, res) => {
  try {
    const { id } = req.params;
    const performedBy = req.user?.provider_id || 'system';

    // Update provider status
    const result = await pool.query(
      `UPDATE providers
       SET is_active = true
       WHERE provider_id = $1
       RETURNING provider_id, full_name, is_active`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Provider not found' });
    }

    // Log to provider_audit_log
    await pool.query(
      `INSERT INTO provider_audit_log (provider_id, action, details, performed_by)
       VALUES ($1, $2, $3, $4)`,
      [id, 'ACTIVATE', JSON.stringify({ activated_at: new Date().toISOString() }), performedBy]
    );

    res.json({
      message: 'Provider activated successfully',
      provider: result.rows[0]
    });
  } catch (error) {
    console.error('Error activating provider:', error);
    res.status(500).json({ error: 'Failed to activate provider' });
  }
});

/**
 * POST /providers/:id/deactivate - Deactivate a user
 * Cannot deactivate yourself
 */
router.post('/providers/:id/deactivate', async (req, res) => {
  try {
    const { id } = req.params;
    const performedBy = req.user?.provider_id || 'system';

    // Check if trying to deactivate themselves
    if (performedBy === id) {
      return res.status(400).json({ error: 'Cannot deactivate yourself' });
    }

    // Update provider status
    const result = await pool.query(
      `UPDATE providers
       SET is_active = false
       WHERE provider_id = $1
       RETURNING provider_id, full_name, is_active`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Provider not found' });
    }

    // Log to provider_audit_log
    await pool.query(
      `INSERT INTO provider_audit_log (provider_id, action, details, performed_by)
       VALUES ($1, $2, $3, $4)`,
      [id, 'DEACTIVATE', JSON.stringify({ deactivated_at: new Date().toISOString() }), performedBy]
    );

    res.json({
      message: 'Provider deactivated successfully',
      provider: result.rows[0]
    });
  } catch (error) {
    console.error('Error deactivating provider:', error);
    res.status(500).json({ error: 'Failed to deactivate provider' });
  }
});

/**
 * POST /providers/:id/reset-password - Reset user password (admin only)
 * Generate a temporary password or accept one from request body
 * bcrypt hash it (12 salt rounds)
 * Set password_must_change = true
 * Log to provider_audit_log
 * Return the temporary password in response
 */
router.post('/providers/:id/reset-password', async (req, res) => {
  try {
    const { id } = req.params;
    const { temporary_password } = req.body;
    const performedBy = req.user?.provider_id || 'system';

    // Generate temporary password if not provided
    let tempPassword = temporary_password;
    if (!tempPassword) {
      // Generate a random 12-character password
      tempPassword = Math.random().toString(36).slice(2, 14);
    }

    // Hash the password with bcrypt (12 salt rounds)
    const passwordHash = await bcrypt.hash(tempPassword, 12);

    // Update provider password and set password_must_change flag
    const result = await pool.query(
      `UPDATE providers
       SET password_hash = $1, password_must_change = true
       WHERE provider_id = $2
       RETURNING provider_id, full_name`,
      [passwordHash, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Provider not found' });
    }

    // Log to provider_audit_log
    await pool.query(
      `INSERT INTO provider_audit_log (provider_id, action, details, performed_by)
       VALUES ($1, $2, $3, $4)`,
      [id, 'RESET_PASSWORD', JSON.stringify({ password_reset_at: new Date().toISOString() }), performedBy]
    );

    res.json({
      message: 'Password reset successfully',
      provider: result.rows[0],
      temporary_password: tempPassword
    });
  } catch (error) {
    console.error('Error resetting password:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

/**
 * GET /hie-logs - View HIE message logs (admin can only view these, not clinical data)
 * Query params: type, direction, limit, offset
 * Returns: log_id, message_id, message_type, event_type, direction, status, destination, source_system, sent_at
 * Does NOT return fhir_bundle (clinical data)
 * Join patients for patient name/MRN only
 */
router.get('/hie-logs', async (req, res) => {
  try {
    const { type, direction, limit = 50, offset = 0 } = req.query;

    // Include both HIE messages AND LIS (lab result) entries so admin sees
    // lab activity even if no ORU_R01 FHIR message was generated.
    let query = `
      SELECT * FROM (
        SELECT
          hl.log_id::text AS log_id, hl.message_id, hl.message_type, hl.event_type,
          hl.direction, hl.status, hl.destination, hl.source_system, hl.sent_at,
          p.patient_id, p.mrn, p.first_name || ' ' || p.last_name AS patient_name
        FROM hie_message_log hl
        LEFT JOIN patients p ON hl.patient_id = p.patient_id
        UNION ALL
        SELECT
          lr.result_id::text AS log_id,
          'LIS-' || lr.result_id::text AS message_id,
          'LIS_RESULT' AS message_type,
          'LAB_RESULT_ENTERED' AS event_type,
          'outbound' AS direction,
          'success' AS status,
          'LIS' AS destination,
          'LIS' AS source_system,
          lr.created_at AS sent_at,
          pt.patient_id, pt.mrn, pt.first_name || ' ' || pt.last_name AS patient_name
        FROM lab_results lr
        JOIN lab_order_tests lot ON lot.order_test_id = lr.order_test_id
        JOIN lab_orders lo ON lo.lab_order_id = lot.lab_order_id
        JOIN patients pt ON pt.patient_id = lo.patient_id
      ) hl
      WHERE 1=1
    `;
    const params = [];

    // Filter by type (message_type)
    if (type) {
      query += ` AND hl.message_type = $${params.length + 1}`;
      params.push(type);
    }

    // Filter by direction
    if (direction) {
      query += ` AND hl.direction = $${params.length + 1}`;
      params.push(direction);
    }

    // Order by sent_at DESC
    query += ` ORDER BY hl.sent_at DESC`;

    // Pagination
    query += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit, 10));
    params.push(parseInt(offset, 10));

    const result = await pool.query(query, params);

    res.json({
      logs: result.rows,
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10)
    });
  } catch (error) {
    console.error('Error fetching HIE logs:', error);
    res.status(500).json({ error: 'Failed to fetch HIE logs' });
  }
});

/**
 * GET /hie-logs/stats - HIE statistics
 * Count by message_type, direction, status
 */
router.get('/hie-logs/stats', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE message_type='ADT_A01') AS "ADT_A01",
        COUNT(*) FILTER (WHERE message_type='ADT_A02') AS "ADT_A02",
        COUNT(*) FILTER (WHERE message_type='ADT_A03') AS "ADT_A03",
        COUNT(*) FILTER (WHERE message_type='ORU_R01') AS "ORU_R01",
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE direction='outbound') AS outbound,
        COUNT(*) FILTER (WHERE direction='inbound') AS inbound,
        COUNT(*) FILTER (WHERE status='error') AS errors
      FROM hie_message_log
    `);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching HIE statistics:', error);
    res.status(500).json({ error: 'Failed to fetch HIE statistics' });
  }
});

/**
 * GET /audit-log - View provider audit log
 * Query params: provider_id, action, limit
 * Returns all audit entries
 */
router.get('/audit-log', async (req, res) => {
  try {
    const { provider_id, action, limit = 100 } = req.query;

    let query = `
      SELECT
        pal.audit_id, pal.provider_id, pal.action, pal.details, pal.performed_by, pal.created_at,
        p1.full_name AS provider_name,
        p2.full_name AS performed_by_name
      FROM provider_audit_log pal
      LEFT JOIN providers p1 ON p1.provider_id = pal.provider_id
      LEFT JOIN providers p2 ON p2.provider_id = pal.performed_by
      WHERE 1=1
    `;
    const params = [];

    // Filter by provider_id
    if (provider_id) {
      query += ` AND pal.provider_id = $${params.length + 1}`;
      params.push(provider_id);
    }

    // Filter by action
    if (action) {
      query += ` AND pal.action = $${params.length + 1}`;
      params.push(action);
    }

    // Order by created_at DESC
    query += ` ORDER BY pal.created_at DESC`;

    // Limit
    query += ` LIMIT $${params.length + 1}`;
    params.push(parseInt(limit, 10));

    const result = await pool.query(query, params);

    res.json({
      auditLog: result.rows,
      limit: parseInt(limit, 10)
    });
  } catch (error) {
    console.error('Error fetching audit log:', error);
    res.status(500).json({ error: 'Failed to fetch audit log' });
  }
});

export default router;
