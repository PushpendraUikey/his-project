const BASE = '/api';

function getToken() {
  try {
    const stored = sessionStorage.getItem('his_auth');
    if (!stored) return null;
    return JSON.parse(stored)?.token || null;
  } catch { return null; }
}

async function req(path, options = {}) {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  // Token expired or unauthorized — clear session and redirect to login
  if (res.status === 401 || res.status === 403) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    // Only auto-redirect for auth errors, not permission errors
    if (res.status === 401) {
      sessionStorage.removeItem('his_auth');
      window.location.href = '/login';
    }
    throw new Error(err.error || 'Access denied');
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    const errorMsg = err.error || (err.errors ? err.errors.join('\\n') : 'Request failed');
    throw new Error(errorMsg);
  }
  return res.json();
}

// Strip undefined/null values before creating URL params
function cleanParams(params) {
  const cleaned = {};
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') cleaned[k] = v;
  }
  return new URLSearchParams(cleaned).toString();
}

export const api = {
  // ── Auth ──────────────────────────────────────────────────
  login:          (data) => req('/auth/login', { method: 'POST', body: data }),
  register:       (data) => req('/auth/register', { method: 'POST', body: data }),
  changePassword: (data) => req('/auth/change-password', { method: 'POST', body: data }),
  me:             ()     => req('/auth/me'),

  // ── Registration (PAS) ───────────────────────────────────
  searchPatients:    (q, unadmitted = false) => {
    let url = `/registration/patients?`;
    if (q) url += `q=${encodeURIComponent(q)}&`;
    if (unadmitted) url += `unadmitted=true`;
    return req(url.endsWith('?') || url.endsWith('&') ? url.slice(0, -1) : url);
  },
  getPatient:        (id) => req(`/registration/patients/${id}`),
  getPatientVersions:(id) => req(`/registration/patients/${id}/versions`),
  createPatient:     (data) => req('/registration/patients', { method: 'POST', body: data }),
  updatePatient:     (id, data) => req(`/registration/patients/${id}`, { method: 'PUT', body: data }),

  // ── Admission (ADT) ──────────────────────────────────────
  getAvailableBeds:      () => req('/admission/beds'),
  getAllBeds:             () => req('/admission/beds/all'),
  getAdmissionProviders: () => req('/admission/providers'),
  getActiveAdmissions:   () => req('/admission/admissions'),
  getApprovalStatus:     (id) => req(`/admission/admissions/${id}/approval-status`),
  admitPatient:          (data) => req('/admission/admit',    { method: 'POST', body: data }),
  dischargePatient:      (data) => req('/admission/discharge', { method: 'POST', body: data }),
  internalTransfer:      (data) => req('/admission/transfer', { method: 'POST', body: data }),
  externalTransfer:      (data) => req('/admission/external-transfer', { method: 'POST', body: data }),
  getTransfers:          (admissionId) => req(`/admission/transfers/${admissionId}`),
  updateBedStatus:       (id, status) => req(`/admission/beds/${id}/status`, { method: 'PATCH', body: { status } }),

  // ── Nurse ────────────────────────────────────────────────
  getNurseAdmissions: () => req('/nurse/admissions'),
  getVitals:          (id) => req(`/nurse/vitals/${id}`),
  recordVitals:       (data) => req('/nurse/vitals', { method: 'POST', body: data }),
  getNotes:           (id) => req(`/nurse/notes/${id}`),
  addNote:            (data) => req('/nurse/notes', { method: 'POST', body: data }),
  getNurses:          () => req('/nurse/nurses'),

  // ── Doctor ───────────────────────────────────────────────
  getDoctorPatients:  (doctorId) => req(`/doctor/patients${doctorId ? `?doctor_id=${doctorId}` : ''}`),
  getPatientContext:  (admissionId) => req(`/doctor/patient/${admissionId}`),
  createOrder:        (data) => req('/doctor/orders', { method: 'POST', body: data }),
  getLabTests:        () => req('/doctor/lab-tests'),
  getDoctors:         () => req('/doctor/doctors'),
  searchLOINC:        (q) => req(`/loinc?q=${encodeURIComponent(q)}`),
  approveDischarge:   (data) => req('/doctor/approve-discharge', { method: 'POST', body: data }),
  getPendingApprovals:(doctorId) => req(`/doctor/pending-approvals${doctorId ? `?doctor_id=${doctorId}` : ''}`),

  // ── Lab (LIS) ────────────────────────────────────────────
  getLabOrders:    (status) => req(`/lab/orders${status ? `?status=${status}` : ''}`),
  collectSpecimen: (id, data) => req(`/lab/orders/${id}/collect`, { method: 'PATCH', body: data }),
  processOnMachine:(id, data) => req(`/lab/orders/${id}/process`, { method: 'POST', body: data }),
  enterResult:     (data) => req('/lab/results', { method: 'POST', body: data }),
  getTechnicians:  () => req('/lab/technicians'),
  getLabMachines:  () => req('/lab/machines'),

  // ── Verifier ─────────────────────────────────────────────
  getVerifiers:       () => req('/verifier/verifiers'),
  getVerifierOrders:  () => req('/verifier/orders'),
  approveVerifierOrder:(id, data) => req(`/verifier/orders/${id}/approve`, { method: 'POST', body: data }),
  rejectVerifierOrder: (id, data) => req(`/verifier/orders/${id}/reject`, { method: 'POST', body: data }),

  // ── Admin ────────────────────────────────────────────────
  getProviders:       (params = {}) => {
    const q = cleanParams(params);
    return req(`/admin/providers${q ? `?${q}` : ''}`);
  },
  getProvider:        (id) => req(`/admin/providers/${id}`),
  activateProvider:   (id) => req(`/admin/providers/${id}/activate`, { method: 'POST' }),
  deactivateProvider: (id) => req(`/admin/providers/${id}/deactivate`, { method: 'POST' }),
  resetPassword:      (id, data) => req(`/admin/providers/${id}/reset-password`, { method: 'POST', body: data }),
  getAdminHIELogs:    (params = {}) => {
    const q = cleanParams(params);
    return req(`/admin/hie-logs${q ? `?${q}` : ''}`);
  },
  getAdminHIEStats:   () => req('/admin/hie-logs/stats'),
  getProviderAuditLog:(params = {}) => {
    const q = cleanParams(params);
    return req(`/admin/audit-log${q ? `?${q}` : ''}`);
  },

  // ── HIE / FHIR R4 ────────────────────────────────────────
  getHIEMessages:      (params = {}) => {
    const q = cleanParams(params);
    return req(`/hie/messages${q ? `?${q}` : ''}`);
  },
  getHIEMessage:       (id) => req(`/hie/messages/${id}`),
  getHIEStats:         () => req('/hie/stats'),
  sendADTMessage:      (data) => req('/hie/adt', { method: 'POST', body: data }),
  sendLabResultMessage: (data) => req('/hie/lab-result', { method: 'POST', body: data }),
  getFHIRPatient:      (id) => req(`/hie/fhir/Patient/${id}`),
  getFHIREncounter:    (id) => req(`/hie/fhir/Encounter/${id}`),
  getFHIRDiagReport:   (id) => req(`/hie/fhir/DiagnosticReport/${id}`),
};

// ── Helpers ───────────────────────────────────────────────────────────────────
export const formatDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export const formatDateTime = (d) =>
  d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';

export const age = (dob) => {
  if (!dob) return '—';
  return Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000)) + 'y';
};

export const ROLE_LABELS = {
  doctor:            'Doctor',
  nurse:             'Nurse',
  lab_technician:    'Lab Technician',
  admin:             'Administrator',
  registration_desk: 'Registration Desk',
  admission_desk:    'Admission Desk',
  receptionist:      'Receptionist',
};

export const ROLE_COLORS = {
  doctor:            'text-emerald-400 bg-emerald-500/10',
  nurse:             'text-pink-400 bg-pink-500/10',
  lab_technician:    'text-amber-400 bg-amber-500/10',
  admin:             'text-violet-400 bg-violet-500/10',
  registration_desk: 'text-cyan-400 bg-cyan-500/10',
  admission_desk:    'text-blue-400 bg-blue-500/10',
  receptionist:      'text-cyan-400 bg-cyan-500/10',
};

// ── Vital sign thresholds for color coding ────────────────────────────────────
export const VITAL_RANGES = {
  systolic_bp:     { critical_low: 80, low: 90, high: 140, critical_high: 180 },
  diastolic_bp:    { critical_low: 50, low: 60, high: 90, critical_high: 120 },
  heart_rate:      { critical_low: 40, low: 60, high: 100, critical_high: 150 },
  temperature:     { critical_low: 35.0, low: 36.1, high: 37.5, critical_high: 39.5 },
  spo2:            { critical_low: 85, low: 94, high: 100, critical_high: 101 },
  respiratory_rate:{ critical_low: 8, low: 12, high: 20, critical_high: 30 },
};

export function getVitalStatus(key, value) {
  if (value == null || value === '') return 'normal';
  const r = VITAL_RANGES[key];
  if (!r) return 'normal';
  const v = parseFloat(value);
  if (v <= r.critical_low || v >= r.critical_high) return 'critical';
  if (v < r.low || v > r.high) return 'warning';
  return 'normal';
}

export const VITAL_STATUS_COLORS = {
  critical: 'text-red-400 bg-red-500/15 border-red-500/30',
  warning:  'text-orange-400 bg-orange-500/15 border-orange-500/30',
  normal:   'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
};
