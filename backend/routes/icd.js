import { Router } from 'express';
import pool from '../db.js';

const router = Router();

// GET /api/icd/search?q=diabetes
// Returns top 20 matching ICD-11 codes.
// Uses pg_trgm GIN index for fast ILIKE on large dataset.
router.get('/search', async (req, res, next) => {
  try {
    const { q } = req.query;
    if (!q || !q.trim()) return res.json([]);

    const { rows } = await pool.query(
      `SELECT code, description
       FROM icd11_codes
       WHERE description ILIKE '%' || $1 || '%'
          OR code ILIKE $1 || '%'
       ORDER BY
         CASE WHEN code ILIKE $1 || '%' THEN 0 ELSE 1 END,
         length(description)
       LIMIT 20`,
      [q.trim()]
    );

    res.json(rows);
  } catch (err) {
    next(err);
  }
});

export default router;
