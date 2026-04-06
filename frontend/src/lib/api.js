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
    sessionStorage.removeItem('his_auth');
    window.location.href = '/login';
    throw new Error('Session expired. Please log in again.');
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

export const api = {
  // ── Auth ──────────────────────────────────────────────────
  login:  (data) => req('/auth/login', { method: 'POST', body: data }),
  me:     ()     => req('/auth/me'),

  // ── Registration ──────────────────────────────────────────
  searchPatients: (q) => req(`/registration/patients${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  getPatient:     (id) => req(`/registration/patients/${id}`),
  createPatient:  (data) => req('/registration/patients', { method: 'POST', body: data }),
  updatePatient:  (id, data) => req(`/registration/patients/${id}`, { method: 'PUT', body: data }),

  // ── Admission (ADT) ───────────────────────────────────────
  getAvailableBeds:    () => req('/admission/beds'),
  getAllBeds:           () => req('/admission/beds/all'),
  getAdmissionProviders: () => req('/admission/providers'),
  getActiveAdmissions: () => req('/admission/admissions'),
  admitPatient:        (data) => req('/admission/admit',    { method: 'POST', body: data }),
  dischargePatient:    (data) => req('/admission/discharge', { method: 'POST', body: data }),
  internalTransfer:    (data) => req('/admission/transfer', { method: 'POST', body: data }),
  externalTransfer:    (data) => req('/admission/external-transfer', { method: 'POST', body: data }),
  getTransfers:        (admissionId) => req(`/admission/transfers/${admissionId}`),

  // ── Nurse ─────────────────────────────────────────────────
  getNurseAdmissions: () => req('/nurse/admissions'),
  getVitals:          (id) => req(`/nurse/vitals/${id}`),
  recordVitals:       (data) => req('/nurse/vitals', { method: 'POST', body: data }),
  getNotes:           (id) => req(`/nurse/notes/${id}`),
  addNote:            (data) => req('/nurse/notes', { method: 'POST', body: data }),
  getNurses:          () => req('/nurse/nurses'),

  // ── Doctor ────────────────────────────────────────────────
  getDoctorPatients:  (doctorId) => req(`/doctor/patients${doctorId ? `?doctor_id=${doctorId}` : ''}`),
  getPatientContext:  (admissionId) => req(`/doctor/patient/${admissionId}`),
  createOrder:        (data) => req('/doctor/orders', { method: 'POST', body: data }),
  getLabTests:        () => req('/doctor/lab-tests'),
  getDoctors:         () => req('/doctor/doctors'),

  // ── Lab (LIS) ─────────────────────────────────────────────
  getLabOrders:    (status) => req(`/lab/orders${status ? `?status=${status}` : ''}`),
  collectSpecimen: (id, data) => req(`/lab/orders/${id}/collect`, { method: 'PATCH', body: data }),
  enterResult:     (data) => req('/lab/results', { method: 'POST', body: data }),
  getTechnicians:  () => req('/lab/technicians'),

  // ── HIE / FHIR R4 ─────────────────────────────────────────
  getHIEMessages:      (params = {}) => {
    const q = new URLSearchParams(params).toString();
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
  doctor:         'Doctor',
  nurse:          'Nurse',
  lab_technician: 'Lab Technician',
  admin:          'Administrator',
  receptionist:   'Receptionist',
};

export const ROLE_COLORS = {
  doctor:         'text-emerald-400 bg-emerald-500/10',
  nurse:          'text-pink-400 bg-pink-500/10',
  lab_technician: 'text-amber-400 bg-amber-500/10',
  admin:          'text-violet-400 bg-violet-500/10',
  receptionist:   'text-cyan-400 bg-cyan-500/10',
};
