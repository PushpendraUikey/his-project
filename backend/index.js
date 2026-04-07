import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import registrationRoutes  from './routes/registration.js';
import admissionRoutes     from './routes/admission.js';
import nurseRoutes         from './routes/nurse.js';
import doctorRoutes        from './routes/doctor.js';
import labRoutes           from './routes/lab.js';
import authRoutes          from './routes/auth.js';
import hieRoutes           from './routes/hie.js';
import adminRoutes         from './routes/admin.js';

dotenv.config();
const app = express();

app.use(cors());
app.use(express.json());

// ── Module routes ──────────────────────────────────────────
app.use('/api/registration', registrationRoutes);
app.use('/api/admission',    admissionRoutes);
app.use('/api/nurse',        nurseRoutes);
app.use('/api/doctor',       doctorRoutes);
app.use('/api/lab',          labRoutes);
app.use('/api/auth',         authRoutes);
app.use('/api/hie',          hieRoutes);
app.use('/api/admin',        adminRoutes);

// ── Health check ───────────────────────────────────────────
app.get('/api/health', (_req, res) => res.json({ status: 'ok', version: '3.0.0' }));

// ── Global error handler ───────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`MediCore HIS v3.0 running on :${PORT}`));
