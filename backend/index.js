import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import registrationRoutes  from './routes/registration.js';
import admissionRoutes     from './routes/admission.js';
import nurseRoutes         from './routes/nurse.js';
import doctorRoutes        from './routes/doctor.js';
import labRoutes           from './routes/lab.js';

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

// ── Health check ───────────────────────────────────────────
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

// ── Global error handler ───────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`HIS backend running on :${PORT}`));
