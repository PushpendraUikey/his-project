import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import pool from '../db.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_key_change_me';

// Password validation policy
const validatePassword = (password) => {
  const minLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasDigit = /[0-9]/.test(password);

  return {
    isValid: minLength && hasUppercase && hasLowercase && hasDigit,
    errors: [
      !minLength && 'Password must be at least 8 characters',
      !hasUppercase && 'Password must contain at least one uppercase letter',
      !hasLowercase && 'Password must contain at least one lowercase letter',
      !hasDigit && 'Password must contain at least one digit'
    ].filter(Boolean)
  };
};

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

// Middleware factory to require specific roles
export const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
};

// POST /login - Login with provider_code + password
router.post('/login', async (req, res) => {
  const { provider_code, password } = req.body;

  if (!provider_code || !password) {
    return res.status(400).json({ error: 'provider_code and password required' });
  }

  try {
    const { rows } = await pool.query(
      'SELECT provider_id, provider_code, full_name, role, password_hash, is_active, password_must_change FROM providers WHERE provider_code = $1',
      [provider_code]
    );

    if (rows.length === 0) {
      console.log(`Login attempt with non-existent provider_code: ${provider_code}`);
      return res.status(401).json({ error: 'Invalid credentials No such provider found' });
    }

    const user = rows[0];

    // Check if user is active
    if (!user.is_active) {
      return res.status(403).json({ error: 'User account is deactivated' });
    }

    // Check password with bcrypt
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials Really Invalid' });
    }

    // Generate JWT with 24h expiry
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
      password_must_change: user.password_must_change,
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

// POST /register - Admin-only user creation
router.post('/register', authenticateToken, requireRole(['admin']), async (req, res) => {
  const { providerCode, fullName, role, password, specialty, license_number } = req.body;

  // Validate required fields
  if (!providerCode || !fullName || !role || !password) {
    return res.status(400).json({ error: 'providerCode, fullName, role, and password are required' });
  }

  // Validate role is one of the allowed values
  const allowedRoles = ['doctor', 'nurse', 'lab_technician', 'admin', 'registration_desk', 'admission_desk'];
  if (!allowedRoles.includes(role)) {
    return res.status(400).json({
      error: `Invalid role. Must be one of: ${allowedRoles.join(', ')}`
    });
  }

  // Validate password policy
  const passwordValidation = validatePassword(password);
  if (!passwordValidation.isValid) {
    return res.status(400).json({
      error: 'Password does not meet policy requirements',
      details: passwordValidation.errors
    });
  }

  try {
    // Hash password with salt rounds 12
    const hashedPassword = await bcrypt.hash(password, 12);

    const result = await pool.query(
      `INSERT INTO providers (provider_code, full_name, role, password_hash, specialty, license_number, password_must_change, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING provider_id, provider_code, full_name, role, specialty, license_number`,
      [providerCode, fullName, role, hashedPassword, specialty || null, license_number || null, true, true]
    );

    // Log to provider_audit_log
    await pool.query(
      `INSERT INTO provider_audit_log (provider_id, action, details, performed_by)
       VALUES ($1, $2, $3, $4)`,
      [result.rows[0].provider_id, 'CREATE', `User ${providerCode} created with role ${role}`, req.user.provider_id]
    );

    res.status(201).json({
      message: 'User registered successfully',
      user: result.rows[0]
    });

  } catch (error) {
    console.error('Registration error:', error);
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Provider code already exists' });
    }
    res.status(500).json({ error: 'Registration failed' });
  }
});

// POST /change-password - Any authenticated user
router.post('/change-password', authenticateToken, async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'currentPassword and newPassword are required' });
  }

  // Validate new password policy
  const passwordValidation = validatePassword(newPassword);
  if (!passwordValidation.isValid) {
    return res.status(400).json({
      error: 'New password does not meet policy requirements',
      details: passwordValidation.errors
    });
  }

  // Check that newPassword differs from currentPassword
  if (currentPassword === newPassword) {
    return res.status(400).json({ error: 'New password must differ from current password' });
  }

  try {
    // Get current user's password hash
    const { rows } = await pool.query(
      'SELECT password_hash FROM providers WHERE provider_id = $1',
      [req.user.provider_id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify current password with bcrypt
    const isValid = await bcrypt.compare(currentPassword, rows[0].password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Hash new password with salt rounds 12
    const hashedNewPassword = await bcrypt.hash(newPassword, 12);

    // Update password_hash and set password_must_change = false
    await pool.query(
      'UPDATE providers SET password_hash = $1, password_must_change = false WHERE provider_id = $2',
      [hashedNewPassword, req.user.provider_id]
    );

    // Log to provider_audit_log
    await pool.query(
      `INSERT INTO provider_audit_log (provider_id, action, details, performed_by)
       VALUES ($1, $2, $3, $4)`,
      [req.user.provider_id, 'CHANGE_PASSWORD', 'User changed their password', req.user.provider_id]
    );

    res.json({ message: 'Password changed successfully' });

  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Password change failed' });
  }
});

// GET /me - Current user details (requires JWT)
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT provider_id, provider_code, full_name, role, specialty, license_number, is_active, password_must_change FROM providers WHERE provider_id = $1',
      [req.user.provider_id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: rows[0] });

  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to retrieve user details' });
  }
});

export default router;
