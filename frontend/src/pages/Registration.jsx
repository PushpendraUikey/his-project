import { useState, useEffect, useCallback } from 'react';
import { Search, UserPlus, User, Phone, Mail, Edit2, ChevronRight, History } from 'lucide-react';
import { api, formatDate, formatDateTime, age } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { PageHeader, Spinner, ErrorBanner, Modal, EmptyState } from '../components/ui';

const EMPTY_FORM = {
  first_name: '', last_name: '', dob: '', gender: 'male', blood_group: '',
  national_id: '', phone: '', email: '',
  address: { line1: '', city: '', state: '', pincode: '' },
  insurance: { provider_name: '', policy_number: '', group_number: '', valid_from: '', valid_to: '' },
};

const EMPTY_ERRORS = {
  first_name: '', last_name: '', dob: '', gender: '', blood_group: '',
  national_id: '', phone: '', email: '',
  address: { line1: '', city: '', state: '', pincode: '' },
};

function validateForm(form) {
  const errors = JSON.parse(JSON.stringify(EMPTY_ERRORS));

  // First Name
  if (!form.first_name?.trim()) {
    errors.first_name = 'First name is required';
  }

  // Last Name
  if (!form.last_name?.trim()) {
    errors.last_name = 'Last name is required';
  }

  // Date of Birth
  if (!form.dob) {
    errors.dob = 'Date of birth is required';
  } else {
    const dobDate = new Date(form.dob);
    const today = new Date();
    if (dobDate > today) {
      errors.dob = 'Date of birth cannot be in the future';
    }
  }

  // Gender
  if (!form.gender) {
    errors.gender = 'Gender is required';
  }

  // Phone
  if (!form.phone?.trim()) {
    errors.phone = 'Phone is required';
  } else {
    // Keep optional leading +, strip all other non-digits
    const phoneDigits = form.phone.replace(/(?!^\+)[^\d]/g, '');
    if (!/^\d{10}$/.test(phoneDigits) &&
        !/^91\d{10}$/.test(phoneDigits) &&
        !/^\+91\d{10}$/.test(phoneDigits)) {
      errors.phone = 'Phone must be exactly 10 digits (or include +91/91 prefix)';
    }
  }

  // Address
  if (!form.address.line1?.trim()) {
    errors.address.line1 = 'Address line 1 is required';
  }
  if (!form.address.city?.trim()) {
    errors.address.city = 'City is required';
  }
  if (!form.address.state?.trim()) {
    errors.address.state = 'State is required';
  }
  if (!form.address.pincode?.trim()) {
    errors.address.pincode = 'Pincode is required';
  } else if (!/^\d{6}$/.test(form.address.pincode.trim())) {
    errors.address.pincode = 'Pincode must be exactly 6 digits';
  }

  // National ID (Aadhaar) - optional but if provided must be 12 digits
  if (form.national_id?.trim()) {
    const aadhaarDigits = form.national_id.replace(/\D/g, '');
    if (aadhaarDigits.length !== 12) {
      errors.national_id = 'Aadhaar must be 12 digits';
    }
  }

  // Email - optional but if provided must be valid format
  if (form.email?.trim()) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(form.email)) {
      errors.email = 'Invalid email format';
    }
  }

  return errors;
}

function hasErrors(errors) {
  if (errors.first_name || errors.last_name || errors.dob || errors.gender ||
      errors.phone || errors.email || errors.national_id ||
      errors.address.line1 || errors.address.city || errors.address.state || errors.address.pincode) {
    return true;
  }
  return false;
}

export default function Registration() {
  const { user } = useAuth();
  const [patients, setPatients]    = useState([]);
  const [query, setQuery]          = useState('');
  const [loading, setLoading]      = useState(false);
  const [error, setError]          = useState('');
  const [showForm, setShowForm]    = useState(false);
  const [editPatient, setEdit]     = useState(null);
  const [form, setForm]            = useState(EMPTY_FORM);
  const [errors, setErrors]        = useState(EMPTY_ERRORS);
  const [saving, setSaving]        = useState(false);
  const [selected, setSelected]    = useState(null);
  const [versions, setVersions]    = useState([]);
  const [versionLoading, setVersionLoading] = useState(false);
  const [activeTab, setActiveTab]  = useState('info');

  const load = useCallback(async (q = '') => {
    setLoading(true); setError('');
    try { setPatients(await api.searchPatients(q)); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const t = setTimeout(() => load(query), 300);
    return () => clearTimeout(t);
  }, [query, load]);

  function openNew() {
    setForm(EMPTY_FORM);
    setErrors(EMPTY_ERRORS);
    setEdit(null);
    setShowForm(true);
  }

  function openEdit(p) {
    setForm({
      first_name: p.first_name, last_name: p.last_name,
      dob: p.dob?.slice(0, 10) || '', gender: p.gender,
      blood_group: p.blood_group || '', national_id: p.national_id || '',
      phone: p.phone || '', email: p.email || '',
      address: p.address || { line1: '', city: '', state: '', pincode: '' },
      insurance: { provider_name: '', policy_number: '', group_number: '', valid_from: '', valid_to: '' },
    });
    setErrors(EMPTY_ERRORS);
    setEdit(p);
    setShowForm(true);
  }

  function set(field, val) {
    setForm(f => ({ ...f, [field]: val }));
    setErrors(e => ({ ...e, [field]: '' }));
  }

  function setAddr(field, val) {
    setForm(f => ({ ...f, address: { ...f.address, [field]: val } }));
    setErrors(e => ({ ...e, address: { ...e.address, [field]: '' } }));
  }

  function setIns(field, val) {
    setForm(f => ({ ...f, insurance: { ...f.insurance, [field]: val } }));
  }

  async function loadVersions(patientId) {
    setVersionLoading(true);
    try {
      const versionData = await api.getPatientVersions(patientId);
      setVersions(versionData);
    } catch (e) {
      console.error('Error loading versions:', e);
      setVersions([]);
    } finally {
      setVersionLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();

    const formErrors = validateForm(form);
    if (hasErrors(formErrors)) {
      setErrors(formErrors);
      return;
    }

    setSaving(true);
    setError('');
    try {
      const payload = {
        ...form,
        phone: form.phone.replace(/(?!^\+)[^\d]/g, ''),
      };

      if (user?.provider_id) {
        if (editPatient) {
          payload.updated_by = user.provider_id;
        } else {
          payload.created_by = user.provider_id;
        }
      }

      if (editPatient) {
        await api.updatePatient(editPatient.patient_id, payload);
      } else {
        await api.createPatient(payload);
      }
      setShowForm(false);
      load(query);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  const bloodGroups = ['A+','A-','B+','B-','AB+','AB-','O+','O-'];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageHeader
        title="Registration Desk"
        subtitle="Search existing patients or register new ones"
        actions={
          <button className="btn-primary flex items-center gap-2" onClick={openNew}>
            <UserPlus className="w-4 h-4" /> Register Patient
          </button>
        }
      />

      <ErrorBanner message={error} />

      {/* Search */}
      <div className="card mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            className="input pl-9"
            placeholder="Search by MRN, name, or phone..."
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Patient table */}
      <div className="card p-0 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <span className="text-sm font-medium text-slate-300">
            {loading ? 'Searching...' : `${patients.length} patients`}
          </span>
        </div>
        {loading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : patients.length === 0 ? (
          <EmptyState icon={User} message="No patients found" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-950/50">
                <tr>
                  <th className="th">MRN</th>
                  <th className="th">Patient</th>
                  <th className="th">Age / Gender</th>
                  <th className="th">Blood Group</th>
                  <th className="th">Contact</th>
                  <th className="th">Registered</th>
                  <th className="th"></th>
                </tr>
              </thead>
              <tbody>
                {patients.map(p => (
                  <tr key={p.patient_id} className="table-row" onClick={() => {
                    setSelected(p);
                    setActiveTab('info');
                    setVersions([]);
                  }}>
                    <td className="td font-mono text-cyan-400 text-xs">{p.mrn}</td>
                    <td className="td">
                      <div className="font-medium text-slate-200">{p.first_name} {p.last_name}</div>
                    </td>
                    <td className="td">
                      <span>{age(p.dob)}</span>
                      <span className="text-slate-600 mx-1">·</span>
                      <span className="capitalize">{p.gender}</span>
                    </td>
                    <td className="td">
                      {p.blood_group
                        ? <span className="badge badge-red">{p.blood_group}</span>
                        : <span className="text-slate-600">—</span>}
                    </td>
                    <td className="td text-slate-400">{p.phone || p.email || '—'}</td>
                    <td className="td text-slate-500">{formatDate(p.created_at)}</td>
                    <td className="td">
                      <button
                        className="text-slate-600 hover:text-cyan-400 transition-colors"
                        onClick={e => { e.stopPropagation(); openEdit(p); }}
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Patient detail modal */}
      <Modal open={!!selected} onClose={() => setSelected(null)} title="Patient Details" width="max-w-3xl">
        {selected && (
          <div className="space-y-5">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-violet-500/20 flex items-center justify-center text-xl font-semibold text-violet-300">
                {selected.first_name[0]}{selected.last_name[0]}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold text-slate-100">{selected.first_name} {selected.last_name}</h3>
                  {versions.length > 0 && (
                    <span className="badge bg-blue-500/20 text-blue-300 text-xs">v{versions.length}</span>
                  )}
                </div>
                <p className="text-sm font-mono text-cyan-400">{selected.mrn}</p>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-4 border-b border-slate-800">
              <button
                onClick={() => setActiveTab('info')}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'info'
                    ? 'border-cyan-400 text-cyan-300'
                    : 'border-transparent text-slate-400 hover:text-slate-300'
                }`}
              >
                Information
              </button>
              <button
                onClick={() => {
                  setActiveTab('history');
                  if (versions.length === 0) {
                    loadVersions(selected.patient_id);
                  }
                }}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                  activeTab === 'history'
                    ? 'border-cyan-400 text-cyan-300'
                    : 'border-transparent text-slate-400 hover:text-slate-300'
                }`}
              >
                <History className="w-4 h-4" />
                History
              </button>
            </div>

            {/* Info Tab */}
            {activeTab === 'info' && (
              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  {[
                    ['Date of Birth', formatDate(selected.dob)],
                    ['Age', age(selected.dob)],
                    ['Gender', selected.gender],
                    ['Blood Group', selected.blood_group || '—'],
                    ['Phone', selected.phone || '—'],
                    ['Email', selected.email || '—'],
                    ['Aadhaar Number', selected.national_id || '—'],
                  ].map(([l, v]) => (
                    <div key={l}>
                      <p className="label">{l}</p>
                      <p className="text-sm text-slate-200 capitalize">{v}</p>
                    </div>
                  ))}
                </div>

                {/* Address */}
                <div>
                  <p className="label">Address</p>
                  <p className="text-sm text-slate-200">
                    {selected.address?.line1}{selected.address?.line1 && ', '}
                    {selected.address?.city}{selected.address?.city && ', '}
                    {selected.address?.state}{selected.address?.state && ' '}
                    {selected.address?.pincode}
                  </p>
                </div>

                {/* Audit Trail */}
                <div className="pt-4 border-t border-slate-800 space-y-2">
                  {selected.created_by && (
                    <p className="text-xs text-slate-400">
                      Created by: <span className="text-slate-300">{selected.created_by}</span>
                    </p>
                  )}
                  {selected.updated_by && (
                    <p className="text-xs text-slate-400">
                      Last updated by: <span className="text-slate-300">{selected.updated_by}</span>
                    </p>
                  )}
                  {selected.version && (
                    <p className="text-xs text-slate-400">
                      Version: <span className="text-slate-300">{selected.version}</span>
                    </p>
                  )}
                </div>

                <div className="flex gap-2 pt-2">
                  <button className="btn-secondary" onClick={() => { setSelected(null); openEdit(selected); }}>
                    <Edit2 className="w-3.5 h-3.5 inline mr-1" /> Edit
                  </button>
                </div>
              </div>
            )}

            {/* History Tab */}
            {activeTab === 'history' && (
              <div>
                {versionLoading ? (
                  <div className="flex justify-center py-8"><Spinner /></div>
                ) : versions.length === 0 ? (
                  <div className="py-8 text-center text-slate-400">No version history available</div>
                ) : (
                  <div className="space-y-4">
                    {versions.map((v, idx) => (
                      <div key={idx} className="border border-slate-800 rounded-lg p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <p className="font-medium text-slate-200">Version {v.version_number}</p>
                            <p className="text-xs text-slate-400">
                              Changed by: <span className="text-slate-300">{v.changed_by || 'System'}</span>
                            </p>
                            <p className="text-xs text-slate-400">
                              {formatDateTime(v.changed_at)}
                            </p>
                          </div>
                        </div>
                        {v.diff_summary && (
                          <div className="text-sm text-slate-300 bg-slate-900/50 rounded p-2">
                            {v.diff_summary}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Register / Edit form modal */}
      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editPatient ? 'Edit Patient' : 'Register New Patient'}
        width="max-w-2xl"
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <ErrorBanner message={error} />

          {/* Personal info */}
          <div>
            <p className="section-title">Personal Information</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">First Name *</label>
                <input
                  className={`input ${errors.first_name ? 'border-red-500' : ''}`}
                  value={form.first_name}
                  onChange={e => set('first_name', e.target.value)}
                  onBlur={() => {
                    if (!form.first_name?.trim()) {
                      setErrors(e => ({ ...e, first_name: 'First name is required' }));
                    }
                  }}
                  placeholder="First name"
                />
                {errors.first_name && <p className="text-xs text-red-500 mt-1">{errors.first_name}</p>}
              </div>
              <div>
                <label className="label">Last Name *</label>
                <input
                  className={`input ${errors.last_name ? 'border-red-500' : ''}`}
                  value={form.last_name}
                  onChange={e => set('last_name', e.target.value)}
                  onBlur={() => {
                    if (!form.last_name?.trim()) {
                      setErrors(e => ({ ...e, last_name: 'Last name is required' }));
                    }
                  }}
                  placeholder="Last name"
                />
                {errors.last_name && <p className="text-xs text-red-500 mt-1">{errors.last_name}</p>}
              </div>
              <div>
                <label className="label">Date of Birth *</label>
                <input
                  className={`input ${errors.dob ? 'border-red-500' : ''}`}
                  type="date"
                  value={form.dob}
                  onChange={e => set('dob', e.target.value)}
                  max={new Date().toISOString().slice(0, 10)}
                />
                {errors.dob && <p className="text-xs text-red-500 mt-1">{errors.dob}</p>}
              </div>
              <div>
                <label className="label">Gender *</label>
                <select
                  className={`select ${errors.gender ? 'border-red-500' : ''}`}
                  value={form.gender}
                  onChange={e => set('gender', e.target.value)}
                >
                  <option value="">-- Select Gender --</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
                {errors.gender && <p className="text-xs text-red-500 mt-1">{errors.gender}</p>}
              </div>
              <div>
                <label className="label">Blood Group</label>
                <select
                  className="select"
                  value={form.blood_group}
                  onChange={e => set('blood_group', e.target.value)}
                >
                  <option value="">Unknown</option>
                  {bloodGroups.map(b => <option key={b}>{b}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Aadhaar Number</label>
                <input
                  className={`input ${errors.national_id ? 'border-red-500' : ''}`}
                  value={form.national_id}
                  onChange={e => set('national_id', e.target.value)}
                  placeholder="12-digit Aadhaar number"
                />
                {errors.national_id && <p className="text-xs text-red-500 mt-1">{errors.national_id}</p>}
              </div>
            </div>
          </div>

          {/* Contact */}
          <div>
            <p className="section-title">Contact Information</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Phone *</label>
                <input
                  className={`input ${errors.phone ? 'border-red-500' : ''}`}
                  value={form.phone}
                  onChange={e => set('phone', e.target.value)}
                  placeholder="+91 XXXXXXXXXX"
                />
                {errors.phone && <p className="text-xs text-red-500 mt-1">{errors.phone}</p>}
              </div>
              <div>
                <label className="label">Email</label>
                <input
                  className={`input ${errors.email ? 'border-red-500' : ''}`}
                  type="email"
                  value={form.email}
                  onChange={e => set('email', e.target.value)}
                  placeholder="email@example.com"
                />
                {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
              </div>
              <div className="col-span-2">
                <label className="label">Address *</label>
                <input
                  className={`input mb-2 ${errors.address.line1 ? 'border-red-500' : ''}`}
                  value={form.address.line1}
                  onChange={e => setAddr('line1', e.target.value)}
                  placeholder="Street address"
                />
                {errors.address.line1 && <p className="text-xs text-red-500 mb-2">{errors.address.line1}</p>}
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <input
                      className={`input ${errors.address.city ? 'border-red-500' : ''}`}
                      value={form.address.city}
                      onChange={e => setAddr('city', e.target.value)}
                      placeholder="City"
                    />
                    {errors.address.city && <p className="text-xs text-red-500 mt-1">{errors.address.city}</p>}
                  </div>
                  <div>
                    <input
                      className={`input ${errors.address.state ? 'border-red-500' : ''}`}
                      value={form.address.state}
                      onChange={e => setAddr('state', e.target.value)}
                      placeholder="State"
                    />
                    {errors.address.state && <p className="text-xs text-red-500 mt-1">{errors.address.state}</p>}
                  </div>
                  <div>
                    <input
                      className={`input ${errors.address.pincode ? 'border-red-500' : ''}`}
                      value={form.address.pincode}
                      onChange={e => setAddr('pincode', e.target.value)}
                      placeholder="PIN"
                    />
                    {errors.address.pincode && <p className="text-xs text-red-500 mt-1">{errors.address.pincode}</p>}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Insurance (only on register) */}
          {!editPatient && (
            <div>
              <p className="section-title">Insurance (Optional)</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Provider Name</label>
                  <input
                    className="input"
                    value={form.insurance.provider_name}
                    onChange={e => setIns('provider_name', e.target.value)}
                    placeholder="Star Health, HDFC Ergo..."
                  />
                </div>
                <div>
                  <label className="label">Policy Number</label>
                  <input
                    className="input"
                    value={form.insurance.policy_number}
                    onChange={e => setIns('policy_number', e.target.value)}
                    placeholder="Policy #"
                  />
                </div>
                <div>
                  <label className="label">Valid From</label>
                  <input
                    className="input"
                    type="date"
                    value={form.insurance.valid_from}
                    onChange={e => setIns('valid_from', e.target.value)}
                  />
                </div>
                <div>
                  <label className="label">Valid To</label>
                  <input
                    className="input"
                    type="date"
                    value={form.insurance.valid_to}
                    onChange={e => setIns('valid_to', e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="submit" className="btn-primary flex items-center gap-2" disabled={saving}>
              {saving ? <Spinner className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
              {editPatient ? 'Update Patient' : 'Register Patient'}
            </button>
            <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
