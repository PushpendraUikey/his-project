import { useState, useEffect, useCallback } from 'react';
import { Search, UserPlus, User, Phone, Mail, Edit2, ChevronRight } from 'lucide-react';
import { api, formatDate, age } from '../lib/api';
import { PageHeader, Spinner, ErrorBanner, Modal, EmptyState } from '../components/ui';

const EMPTY_FORM = {
  first_name: '', last_name: '', dob: '', gender: 'male', blood_group: '',
  national_id: '', phone: '', email: '',
  address: { line1: '', city: '', state: '', pincode: '' },
  insurance: { provider_name: '', policy_number: '', group_number: '', valid_from: '', valid_to: '' },
};

export default function Registration() {
  const [patients, setPatients]   = useState([]);
  const [query, setQuery]         = useState('');
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const [showForm, setShowForm]   = useState(false);
  const [editPatient, setEdit]    = useState(null);
  const [form, setForm]           = useState(EMPTY_FORM);
  const [saving, setSaving]       = useState(false);
  const [selected, setSelected]   = useState(null);

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
    setForm(EMPTY_FORM); setEdit(null); setShowForm(true);
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
    setEdit(p); setShowForm(true);
  }

  function set(field, val) {
    setForm(f => ({ ...f, [field]: val }));
  }
  function setAddr(field, val) {
    setForm(f => ({ ...f, address: { ...f.address, [field]: val } }));
  }
  function setIns(field, val) {
    setForm(f => ({ ...f, insurance: { ...f.insurance, [field]: val } }));
  }

  async function handleSubmit(e) {
    e.preventDefault(); setSaving(true); setError('');
    try {
      if (editPatient) {
        await api.updatePatient(editPatient.patient_id, form);
      } else {
        await api.createPatient(form);
      }
      setShowForm(false); load(query);
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
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
                  <tr key={p.patient_id} className="table-row" onClick={() => setSelected(p)}>
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
      <Modal open={!!selected} onClose={() => setSelected(null)} title="Patient Details">
        {selected && (
          <div className="space-y-5">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-violet-500/20 flex items-center justify-center text-xl font-semibold text-violet-300">
                {selected.first_name[0]}{selected.last_name[0]}
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-100">{selected.first_name} {selected.last_name}</h3>
                <p className="text-sm font-mono text-cyan-400">{selected.mrn}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                ['Date of Birth', formatDate(selected.dob)],
                ['Age', age(selected.dob)],
                ['Gender', selected.gender],
                ['Blood Group', selected.blood_group || '—'],
                ['Phone', selected.phone || '—'],
                ['Email', selected.email || '—'],
                ['National ID', selected.national_id || '—'],
              ].map(([l, v]) => (
                <div key={l}>
                  <p className="label">{l}</p>
                  <p className="text-sm text-slate-200 capitalize">{v}</p>
                </div>
              ))}
            </div>
            <div className="flex gap-2 pt-2">
              <button className="btn-secondary" onClick={() => { setSelected(null); openEdit(selected); }}>
                <Edit2 className="w-3.5 h-3.5 inline mr-1" /> Edit
              </button>
            </div>
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
                <input className="input" required value={form.first_name}
                  onChange={e => set('first_name', e.target.value)} placeholder="First name" />
              </div>
              <div>
                <label className="label">Last Name *</label>
                <input className="input" required value={form.last_name}
                  onChange={e => set('last_name', e.target.value)} placeholder="Last name" />
              </div>
              <div>
                <label className="label">Date of Birth *</label>
                <input className="input" type="date" required value={form.dob}
                  onChange={e => set('dob', e.target.value)} />
              </div>
              <div>
                <label className="label">Gender *</label>
                <select className="select" value={form.gender} onChange={e => set('gender', e.target.value)}>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="label">Blood Group</label>
                <select className="select" value={form.blood_group} onChange={e => set('blood_group', e.target.value)}>
                  <option value="">Unknown</option>
                  {bloodGroups.map(b => <option key={b}>{b}</option>)}
                </select>
              </div>
              <div>
                <label className="label">National ID</label>
                <input className="input" value={form.national_id}
                  onChange={e => set('national_id', e.target.value)} placeholder="Aadhaar / PAN" />
              </div>
            </div>
          </div>

          {/* Contact */}
          <div>
            <p className="section-title">Contact Information</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Phone</label>
                <input className="input" value={form.phone}
                  onChange={e => set('phone', e.target.value)} placeholder="+91 XXXXX XXXXX" />
              </div>
              <div>
                <label className="label">Email</label>
                <input className="input" type="email" value={form.email}
                  onChange={e => set('email', e.target.value)} placeholder="email@example.com" />
              </div>
              <div className="col-span-2">
                <label className="label">Address</label>
                <input className="input mb-2" value={form.address.line1}
                  onChange={e => setAddr('line1', e.target.value)} placeholder="Street address" />
                <div className="grid grid-cols-3 gap-2">
                  <input className="input" value={form.address.city}
                    onChange={e => setAddr('city', e.target.value)} placeholder="City" />
                  <input className="input" value={form.address.state}
                    onChange={e => setAddr('state', e.target.value)} placeholder="State" />
                  <input className="input" value={form.address.pincode}
                    onChange={e => setAddr('pincode', e.target.value)} placeholder="PIN" />
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
                  <input className="input" value={form.insurance.provider_name}
                    onChange={e => setIns('provider_name', e.target.value)} placeholder="Star Health, HDFC Ergo..." />
                </div>
                <div>
                  <label className="label">Policy Number</label>
                  <input className="input" value={form.insurance.policy_number}
                    onChange={e => setIns('policy_number', e.target.value)} placeholder="Policy #" />
                </div>
                <div>
                  <label className="label">Valid From</label>
                  <input className="input" type="date" value={form.insurance.valid_from}
                    onChange={e => setIns('valid_from', e.target.value)} />
                </div>
                <div>
                  <label className="label">Valid To</label>
                  <input className="input" type="date" value={form.insurance.valid_to}
                    onChange={e => setIns('valid_to', e.target.value)} />
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
