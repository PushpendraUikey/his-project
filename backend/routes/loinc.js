import { Router } from 'express';
import pool from '../db.js';

const router = Router();

// GET /api/loinc?q=glucose
router.get('/', async (req, res, next) => {
  try {
    const { q } = req.query;
    if (!q) return res.json([]); // Return empty if no query

    // Search by loinc_num or name or short_name
    const { rows } = await pool.query(
      `SELECT * FROM loinc_codes 
       WHERE name ILIKE $1 OR short_name ILIKE $1 OR loinc_num ILIKE $1
       ORDER BY loinc_num ASC
       LIMIT 50`,
      [`%${q}%`]
    );

    res.json(rows);
  } catch (err) {
    next(err);
  }
});

export default router;
