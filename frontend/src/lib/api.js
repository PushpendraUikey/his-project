const BASE = '/api';

async function req(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

// ── Registration ─────────────────────────────────────────
export const api = {
  // Registration
  searchPatients:  (q) => req(`/registration/patients${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  getPatient:      (id) => req(`/registration/patients/${id}`),
  createPatient:   (data) => req('/registration/patients', { method: 'POST', body: data }),
  updatePatient:   (id, data) => req(`/registration/patients/${id}`, { method: 'PUT', body: data }),

  // Admission
  getAvailableBeds:  () => req('/admission/beds'),
  getAllBeds:         () => req('/admission/beds/all'),
  getAdmissionProviders: () => req('/admission/providers'),
  getActiveAdmissions: () => req('/admission/admissions'),
  admitPatient:      (data) => req('/admission/admit', { method: 'POST', body: data }),
  dischargePatient:  (data) => req('/admission/discharge', { method: 'POST', body: data }),

  // Nurse
  getNurseAdmissions: () => req('/nurse/admissions'),
  getVitals:          (id) => req(`/nurse/vitals/${id}`),
  recordVitals:       (data) => req('/nurse/vitals', { method: 'POST', body: data }),
  getNotes:           (id) => req(`/nurse/notes/${id}`),
  addNote:            (data) => req('/nurse/notes', { method: 'POST', body: data }),
  getNurses:          () => req('/nurse/nurses'),

  // Doctor
  getDoctorPatients:  (doctorId) => req(`/doctor/patients${doctorId ? `?doctor_id=${doctorId}` : ''}`),
  getPatientContext:  (admissionId) => req(`/doctor/patient/${admissionId}`),
  createOrder:        (data) => req('/doctor/orders', { method: 'POST', body: data }),
  getLabTests:        () => req('/doctor/lab-tests'),
  getDoctors:         () => req('/doctor/doctors'),

  // Lab
  getLabOrders:       (status) => req(`/lab/orders${status ? `?status=${status}` : ''}`),
  collectSpecimen:    (id, data) => req(`/lab/orders/${id}/collect`, { method: 'PATCH', body: data }),
  enterResult:        (data) => req('/lab/results', { method: 'POST', body: data }),
  getTechnicians:     () => req('/lab/technicians'),
};

// Helpers
export const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }) : '—';
export const formatDateTime = (d) => d ? new Date(d).toLocaleString('en-IN', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }) : '—';
export const age = (dob) => {
  if (!dob) return '—';
  const diff = Date.now() - new Date(dob).getTime();
  return Math.floor(diff / (365.25 * 24 * 3600 * 1000)) + 'y';
};
