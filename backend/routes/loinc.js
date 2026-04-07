import { Router } from 'express';
import pool from '../db.js';

const router = Router();

// GET /api/loinc?q=glucose
// Searches full LOINC database (109k codes). Returns top 20 matches.
router.get('/', async (req, res, next) => {
  try {
    const { q } = req.query;
    if (!q) return res.json([]);

    const { rows } = await pool.query(
      `SELECT loinc_num, name, short_name, class
       FROM loinc_codes
       WHERE (name ILIKE $1 OR short_name ILIKE $1 OR loinc_num ILIKE $1)
         AND name NOT ILIKE 'Deprecated%'
       ORDER BY
         CASE WHEN loinc_num ILIKE $1 THEN 0 ELSE 1 END,
         length(name)
       LIMIT 20`,
      [`%${q}%`]
    );

    res.json(rows);
  } catch (err) {
    next(err);
  }
});

export default router;
