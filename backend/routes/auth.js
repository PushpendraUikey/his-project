import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import pool from '../db.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_key_change_me';

// Login endpoint
router.post('/login', async (req, res) => {
  const { providerCode, password } = req.body;
  if (!providerCode || !password) {
    return res.status(400).json({ error: 'providerCode and password required' });
  }

  try {
    const { rows } = await pool.query(
      'SELECT provider_id, provider_code, full_name, role, password_hash FROM providers WHERE provider_code = $1',
      [providerCode]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = rows[0];

    // Check pass
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT
    const token = jwt.sign(
      {
        provider_id: user.provider_id,
        provider_code: user.provider_code,
        role: user.role,
        full_name: user.full_name
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Logged in successfully',
      token,
      user: {
        provider_id: user.provider_id,
        provider_code: user.provider_code,
        role: user.role,
        full_name: user.full_name
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error during login' });
  }
});

// Middleware to verify JWT - export for reuse
export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token == null) return res.status(401).json({ error: 'Token required' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
};

// Get current user details
router.get('/me', authenticateToken, async (req, res) => {
  res.json({ user: req.user });
});

export default router;
