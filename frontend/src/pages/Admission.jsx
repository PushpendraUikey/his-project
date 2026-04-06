import { useState, useEffect, useCallback } from 'react';
import { BedDouble, Search, UserCheck, LogOut, Plus } from 'lucide-react';
import { api, formatDateTime, age } from '../lib/api';
import { PageHeader, Spinner, ErrorBanner, Modal, StatCard, EmptyState } from '../components/ui';

const EMPTY_ADMIT = {
  patient_id: '', bed_id: '', admitting_provider_id: '', attending_provider_id: '',
  admission_type: 'emergency', admission_source: 'emergency',
  chief_complaint: '', diagnosis_primary: '',
};

export default function Admission() {
  const [admissions, setAdmissions] = useState([]);
  const [beds, setBeds]             = useState([]);
  const [allBeds, setAllBeds]       = useState([]);
  const [providers, setProviders]   = useState([]);
  const [patients, setPatients]     = useState([]);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');
  const [showAdmit, setShowAdmit]   = useState(false);
  const [showDischarge, setShowDischarge] = useState(null);
  const [form, setForm]             = useState(EMPTY_ADMIT);
  const [ptSearch, setPtSearch]     = useState('');
  const [saving, setSaving]         = useState(false);
  const [tab, setTab]               = useState('active'); // active | beds

  const loadAll = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [adm, av, all, prov] = await Promise.all([
        api.getActiveAdmissions(),
        api.getAvailableBeds(),
        api.getAllBeds(),
        api.getAdmissionProviders(),
      ]);
      setAdmissions(adm); setBeds(av); setAllBeds(all); setProviders(prov);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  useEffect(() => {
    if (!ptSearch.trim()) { setPatients([]); return; }
    const t = setTimeout(async () => {
      try { setPatients(await api.searchPatients(ptSearch)); } catch {}
    }, 300);
    return () => clearTimeout(t);
  }, [ptSearch]);

  function set(field, val) { setForm(f => ({ ...f, [field]: val })); }

  async function handleAdmit(e) {
    e.preventDefault(); setSaving(true); setError('');
    try {
      await api.admitPatient(form);
      setShowAdmit(false); setForm(EMPTY_ADMIT); setPtSearch(''); loadAll();
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  }

  async function handleDischarge(e) {
    e.preventDefault(); setSaving(true); setError('');
    const fd = new FormData(e.target);
    try {
      await api.dischargePatient({
        admission_id: showDischarge.admission_id,
        discharging_provider_id: providers[0]?.provider_id,
        discharge_disposition: fd.get('disposition'),
        discharge_condition: fd.get('condition'),
        discharge_summary: fd.get('summary'),
        follow_up_required: fd.get('followup') === 'on',
      });
      setShowDischarge(null); loadAll();
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  }

  const available = allBeds.filter(b => b.status === 'available').length;
  const occupied  = allBeds.filter(b => b.status === 'occupied').length;
  const cleaning  = allBeds.filter(b => b.status === 'cleaning').length;

  const statusColor = {
    available:   'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
    occupied:    'bg-red-500/20 text-red-400 border border-red-500/30',
    cleaning:    'bg-amber-500/20 text-amber-400 border border-amber-500/30',
    maintenance: 'bg-slate-700 text-slate-400',
    blocked:     'bg-slate-700 text-slate-500',
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageHeader
        title="Admission Desk"
        subtitle="Manage patient admissions, bed allocation, and discharges"
        actions={
          <button className="btn-primary flex items-center gap-2" onClick={() => setShowAdmit(true)}>
            <Plus className="w-4 h-4" /> Admit Patient
          </button>
        }
      />

      <ErrorBanner message={error} />

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard label="Active Admissions" value={admissions.length} color="text-cyan-400" />
        <StatCard label="Available Beds" value={available} color="text-emerald-400" />
        <StatCard label="Occupied Beds" value={occupied} color="text-red-400" />
        <StatCard label="In Cleaning" value={cleaning} color="text-amber-400" />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-slate-900 border border-slate-800 rounded-lg p-1 w-fit">
        {['active', 'beds'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
              tab === t ? 'bg-slate-700 text-slate-100' : 'text-slate-500 hover:text-slate-300'
            }`}>
            {t === 'active' ? 'Active Admissions' : 'Bed Status'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : tab === 'active' ? (
        /* Admissions table */
        <div className="card p-0 overflow-hidden">
          {admissions.length === 0 ? (
            <EmptyState icon={BedDouble} message="No active admissions" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-950/50">
                  <tr>
                    <th className="th">Admission #</th>
                    <th className="th">Patient</th>
                    <th className="th">Ward / Bed</th>
                    <th className="th">Type</th>
                    <th className="th">Doctor</th>
                    <th className="th">Admitted</th>
                    <th className="th">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {admissions.map(a => (
                    <tr key={a.admission_id} className="table-row">
                      <td className="td font-mono text-cyan-400 text-xs">{a.admission_number}</td>
                      <td className="td">
                        <div className="font-medium text-slate-200">{a.patient_name}</div>
                        <div className="text-xs text-slate-500">{a.mrn} · {age(a.dob)} · {a.gender}</div>
                      </td>
                      <td className="td">
                        <div className="text-slate-300">{a.ward_name || '—'}</div>
                        {a.bed_number && <div className="text-xs text-slate-500">Bed {a.bed_number}</div>}
                      </td>
                      <td className="td">
                        <span className="badge badge-blue capitalize">{a.admission_type}</span>
                      </td>
                      <td className="td text-slate-400 text-xs">{a.attending_doctor || '—'}</td>
                      <td className="td text-slate-500 text-xs">{formatDateTime(a.admitted_at)}</td>
                      <td className="td">
                        <button className="btn-danger text-xs px-3 py-1.5 flex items-center gap-1"
                          onClick={() => setShowDischarge(a)}>
                          <LogOut className="w-3 h-3" /> Discharge
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* Bed grid */
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {allBeds.map(b => (
            <div key={b.bed_id}
              className={`rounded-xl p-4 text-center ${statusColor[b.status] || 'bg-slate-800 text-slate-400'}`}>
              <div className="text-xs font-semibold mb-1">{b.bed_number}</div>
              <div className="text-xs opacity-70 mb-2 truncate">{b.ward_name}</div>
              {b.patient_name && (
                <div className="text-xs font-medium truncate">{b.patient_name}</div>
              )}
              <div className="text-xs opacity-60 mt-1 capitalize">{b.status}</div>
            </div>
          ))}
        </div>
      )}

      {/* Admit modal */}
      <Modal open={showAdmit} onClose={() => setShowAdmit(false)} title="Admit Patient" width="max-w-2xl">
        <form onSubmit={handleAdmit} className="space-y-5">
          <ErrorBanner message={error} />

          <div>
            <p className="section-title">Patient Search</p>
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input className="input pl-9" placeholder="Search patient by name or MRN..."
                value={ptSearch} onChange={e => setPtSearch(e.target.value)} />
            </div>
            {patients.length > 0 && (
              <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden max-h-40 overflow-y-auto">
                {patients.map(p => (
                  <button key={p.patient_id} type="button"
                    className={`w-full text-left px-4 py-2.5 text-sm hover:bg-slate-700 transition-colors flex items-center justify-between ${form.patient_id === p.patient_id ? 'bg-slate-700 text-cyan-400' : 'text-slate-300'}`}
                    onClick={() => { set('patient_id', p.patient_id); setPtSearch(`${p.first_name} ${p.last_name} (${p.mrn})`); setPatients([]); }}>
                    <span>{p.first_name} {p.last_name}</span>
                    <span className="font-mono text-xs text-slate-500">{p.mrn}</span>
                  </button>
                ))}
              </div>
            )}
            {form.patient_id && (
              <p className="text-xs text-emerald-400 mt-1 flex items-center gap-1">
                <UserCheck className="w-3 h-3" /> Patient selected
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Admission Type *</label>
              <select className="select" value={form.admission_type} onChange={e => set('admission_type', e.target.value)}>
                {['emergency','elective','day_care','maternity','transfer_in'].map(t => (
                  <option key={t} value={t} className="capitalize">{t.replace('_',' ')}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Admission Source</label>
              <select className="select" value={form.admission_source} onChange={e => set('admission_source', e.target.value)}>
                {['opd','emergency','referral','transfer_in','direct'].map(s => (
                  <option key={s} value={s}>{s.replace('_',' ')}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Assign Bed</label>
              <select className="select" value={form.bed_id} onChange={e => set('bed_id', e.target.value)}>
                <option value="">— No bed yet —</option>
                {beds.map(b => (
                  <option key={b.bed_id} value={b.bed_id}>
                    {b.bed_number} · {b.ward_name} ({b.bed_type})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Attending Doctor *</label>
              <select className="select" required value={form.attending_provider_id}
                onChange={e => { set('attending_provider_id', e.target.value); set('admitting_provider_id', e.target.value); }}>
                <option value="">Select doctor</option>
                {providers.map(p => (
                  <option key={p.provider_id} value={p.provider_id}>{p.full_name} ({p.specialty})</option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <label className="label">Chief Complaint</label>
              <input className="input" value={form.chief_complaint}
                onChange={e => set('chief_complaint', e.target.value)}
                placeholder="Primary reason for admission..." />
            </div>
            <div className="col-span-2">
              <label className="label">Provisional Diagnosis</label>
              <input className="input" value={form.diagnosis_primary}
                onChange={e => set('diagnosis_primary', e.target.value)}
                placeholder="Provisional / working diagnosis..." />
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            <button type="submit" className="btn-primary flex items-center gap-2" disabled={saving || !form.patient_id}>
              {saving ? <Spinner className="w-4 h-4" /> : <BedDouble className="w-4 h-4" />}
              Admit Patient
            </button>
            <button type="button" className="btn-secondary" onClick={() => setShowAdmit(false)}>Cancel</button>
          </div>
        </form>
      </Modal>

      {/* Discharge modal */}
      <Modal open={!!showDischarge} onClose={() => setShowDischarge(null)} title="Discharge Patient">
        {showDischarge && (
          <form onSubmit={handleDischarge} className="space-y-4">
            <div className="bg-slate-800 rounded-lg px-4 py-3 text-sm">
              <p className="font-medium text-slate-200">{showDischarge.patient_name}</p>
              <p className="text-slate-500 text-xs">{showDischarge.admission_number} · {showDischarge.ward_name}</p>
            </div>
            <div>
              <label className="label">Discharge Disposition *</label>
              <select name="disposition" className="select" required>
                {['home','transfer_out','lama','expired','referred','absconded'].map(d => (
                  <option key={d} value={d}>{d.replace('_',' ')}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Patient Condition</label>
              <select name="condition" className="select">
                {['stable','critical','improved','unchanged','deceased'].map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Discharge Summary</label>
              <textarea name="summary" className="input h-24 resize-none"
                placeholder="Brief discharge summary..." />
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer">
              <input type="checkbox" name="followup" className="rounded" />
              Follow-up required
            </label>
            <div className="flex gap-3 pt-1">
              <button type="submit" className="btn-danger flex items-center gap-2" disabled={saving}>
                {saving ? <Spinner className="w-4 h-4" /> : <LogOut className="w-4 h-4" />}
                Confirm Discharge
              </button>
              <button type="button" className="btn-secondary" onClick={() => setShowDischarge(null)}>Cancel</button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
