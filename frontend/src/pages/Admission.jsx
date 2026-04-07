import { useState, useEffect, useCallback } from 'react';
import { BedDouble, Search, UserCheck, LogOut, Plus, ArrowRightLeft, ArrowUpRight, Network, CheckCircle, AlertCircle } from 'lucide-react';
import { api, formatDateTime, age } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { PageHeader, Spinner, ErrorBanner, Modal, StatCard, EmptyState } from '../components/ui';

const EMPTY_ADMIT = {
  patient_id: '', bed_id: '', admitting_provider_id: '', attending_provider_id: '',
  admission_type: 'emergency', admission_source: 'emergency',
  chief_complaint: '', diagnosis_primary: '',
};

export default function Admission() {
  const { user } = useAuth();
  const [admissions, setAdmissions] = useState([]);
  const [beds, setBeds]             = useState([]);
  const [allBeds, setAllBeds]       = useState([]);
  const [providers, setProviders]   = useState([]);
  const [patients, setPatients]     = useState([]);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');
  const [showAdmit, setShowAdmit]   = useState(false);
  const [showDischarge, setShowDischarge] = useState(null);
  const [showTransfer, setShowTransfer]   = useState(null);
  const [form, setForm]             = useState(EMPTY_ADMIT);
  const [ptSearch, setPtSearch]     = useState('');
  const [saving, setSaving]         = useState(false);
  const [tab, setTab]               = useState('active');
  const [fhirToast, setFhirToast]   = useState('');

  // Transfer form state
  const [transferType, setTransferType] = useState('internal');
  const [transferBedId, setTransferBedId] = useState('');
  const [transferFacility, setTransferFacility] = useState('');
  const [transferAddress, setTransferAddress] = useState('');
  const [transferReason, setTransferReason] = useState('');

  const showFhir = (msg) => {
    setFhirToast(msg);
    setTimeout(() => setFhirToast(''), 4000);
  };

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
      try { setPatients(await api.searchPatients(ptSearch, true)); } catch {}
    }, 300);
    return () => clearTimeout(t);
  }, [ptSearch]);

  function set(field, val) { setForm(f => ({ ...f, [field]: val })); }

  async function handleAdmit(e) {
    e.preventDefault(); setSaving(true); setError('');
    try {
      const admission = await api.admitPatient(form);
      // Send FHIR ADT A01 message to HIE
      try {
        await api.sendADTMessage({
          admission_id: admission.admission_id,
          event_type: 'ADMIT',
          triggered_by: user?.provider_id,
          destination: 'internal',
        });
        showFhir('✅ FHIR ADT A01 (Admit) sent to HIE');
      } catch { showFhir('⚠️ ADT message failed — patient admitted'); }
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
        discharging_provider_id: user?.provider_id || providers[0]?.provider_id,
        discharge_disposition: fd.get('disposition'),
        discharge_condition: fd.get('condition'),
        discharge_summary: fd.get('summary'),
        follow_up_required: fd.get('followup') === 'on',
      });
      // Send FHIR ADT A03 (Discharge)
      try {
        await api.sendADTMessage({
          admission_id: showDischarge.admission_id,
          event_type: 'DISCHARGE',
          triggered_by: user?.provider_id,
          destination: 'internal',
        });
        showFhir('✅ FHIR ADT A03 (Discharge) sent to HIE');
      } catch { showFhir('⚠️ FHIR message failed'); }
      setShowDischarge(null); loadAll();
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  }

  async function handleTransfer(e) {
    e.preventDefault(); setSaving(true); setError('');
    try {
      if (transferType === 'internal') {
        if (!transferBedId) { setError('Please select a destination bed.'); setSaving(false); return; }
        await api.internalTransfer({
          admission_id: showTransfer.admission_id,
          to_bed_id: transferBedId,
          reason: transferReason,
          ordered_by: user?.provider_id,
        });
      } else {
        if (!transferFacility) { setError('Please enter destination facility name.'); setSaving(false); return; }
        await api.externalTransfer({
          admission_id: showTransfer.admission_id,
          to_facility_name: transferFacility,
          to_facility_address: transferAddress,
          reason: transferReason,
          ordered_by: user?.provider_id,
        });
      }
      // Send FHIR ADT A02 (Transfer)
      try {
        await api.sendADTMessage({
          admission_id: showTransfer.admission_id,
          event_type: 'TRANSFER',
          triggered_by: user?.provider_id,
          destination: transferType === 'internal' ? 'internal' : transferFacility,
        });
        showFhir(`✅ FHIR ADT A02 (Transfer) sent to HIE → ${transferType === 'external' ? transferFacility : 'internal'}`);
      } catch { showFhir('⚠️ FHIR ADT message failed'); }
      setShowTransfer(null); setTransferBedId(''); setTransferFacility('');
      setTransferAddress(''); setTransferReason(''); loadAll();
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  }

  const available = allBeds.filter(b => b.status === 'available').length;
  const occupied  = allBeds.filter(b => b.status === 'occupied').length;
  const dirty     = allBeds.filter(b => b.status === 'dirty').length;

  const statusColor = {
    available:   'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
    occupied:    'bg-red-500/20 text-red-400 border border-red-500/30',
    dirty:       'bg-amber-500/20 text-amber-400 border border-amber-500/30',
    maintenance: 'bg-slate-700 text-slate-400',
    blocked:     'bg-slate-700 text-slate-500',
  };

  async function setBedStatus(bedId, newStatus) {
    try {
      await api.updateBedStatus(bedId, newStatus);
      loadAll();
    } catch (e) { setError(e.message); }
  }

  // Filter beds based on admission type
  const filteredBeds = form.admission_type === 'emergency'
    ? beds.filter(b => b.ward_type === 'emergency')
    : beds;

  // Helper to get approval badge
  const getApprovalBadge = (admission) => {
    if (!admission.discharge_approved) {
      return { label: 'Pending', bgClass: 'bg-slate-500/20 text-slate-400 border border-slate-500/30' };
    }
    if (admission.discharge_decision === 'discharge') {
      return { label: 'Discharge OK', bgClass: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' };
    }
    if (admission.discharge_decision === 'transfer') {
      return { label: 'Transfer OK', bgClass: 'bg-amber-500/20 text-amber-400 border border-amber-500/30' };
    }
    if (admission.discharge_decision === 'continue') {
      return { label: 'Continue', bgClass: 'bg-blue-500/20 text-blue-400 border border-blue-500/30' };
    }
    return { label: 'Pending', bgClass: 'bg-slate-500/20 text-slate-400 border border-slate-500/30' };
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* FHIR Toast */}
      {fhirToast && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 bg-slate-800 border border-cyan-500/40 text-cyan-400 text-sm rounded-xl px-5 py-3 shadow-xl">
          <Network className="w-4 h-4 shrink-0" />
          {fhirToast}
        </div>
      )}

      <PageHeader
        title="Admission Desk (ADT)"
        subtitle="Admissions, Discharges & Transfers — FHIR R4 ADT messages sent to HIE automatically"
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
        <StatCard label="Available Beds"    value={available}         color="text-emerald-400" />
        <StatCard label="Occupied Beds"     value={occupied}          color="text-red-400" />
        <StatCard label="Dirty Beds"        value={dirty}             color="text-amber-400" />
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
                    <th className="th">Approval</th>
                    <th className="th">Admitted</th>
                    <th className="th">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {admissions.map(a => {
                    const approval = getApprovalBadge(a);
                    const isDischargeApproved = a.discharge_approved === true;

                    return (
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
                          <span className="badge badge-blue capitalize">{(a.admission_type || '').replace(/_/g, ' ')}</span>
                        </td>
                        <td className="td text-slate-400 text-xs">{a.attending_doctor || '—'}</td>
                        <td className="td">
                          <span className={`badge text-xs ${approval.bgClass}`}>
                            {approval.label}
                          </span>
                        </td>
                        <td className="td text-slate-500 text-xs">{formatDateTime(a.admitted_at)}</td>
                        <td className="td">
                          <div className="flex items-center gap-2">
                            <button className="btn-secondary text-xs px-2.5 py-1.5 flex items-center gap-1"
                              onClick={() => { setShowTransfer(a); setTransferType('internal'); }}>
                              <ArrowRightLeft className="w-3 h-3" /> Transfer
                            </button>
                            <div className="group relative">
                              <button
                                className={`text-xs px-2.5 py-1.5 flex items-center gap-1 rounded-md transition-all ${
                                  isDischargeApproved
                                    ? 'btn-danger'
                                    : 'bg-red-500/20 text-red-400 border border-red-500/30 cursor-not-allowed opacity-50'
                                }`}
                                onClick={() => isDischargeApproved && setShowDischarge(a)}
                                disabled={!isDischargeApproved}>
                                <LogOut className="w-3 h-3" /> Discharge
                                {isDischargeApproved && <CheckCircle className="w-3 h-3 text-emerald-400" />}
                              </button>
                              {!isDischargeApproved && (
                                <div className="absolute bottom-full left-0 mb-2 px-2 py-1 bg-slate-800 border border-slate-700 text-xs text-slate-300 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-10">
                                  Awaiting doctor approval
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
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
              {b.status === 'dirty' && (
                <button className="mt-2 text-[10px] bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded px-2 py-1 transition-colors w-full"
                  onClick={() => setBedStatus(b.bed_id, 'available')}>
                  Mark Clean
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Admit Modal ─────────────────────────────────────────── */}
      <Modal open={showAdmit} onClose={() => setShowAdmit(false)} title="Admit Patient" width="max-w-2xl">
        <form onSubmit={handleAdmit} className="space-y-5">
          <ErrorBanner message={error} />

          <div>
            <p className="section-title">Patient Search</p>
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input className="input pl-9" placeholder="Search patient by name or MRN…"
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

            {/* Emergency Ward Enforcement Banner */}
            {form.admission_type === 'emergency' && filteredBeds.length > 0 && (
              <div className="col-span-2 flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-lg px-4 py-2.5 text-xs text-amber-400">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                Emergency admissions are restricted to Emergency Ward beds only
              </div>
            )}

            <div>
              <label className="label">Assign Bed</label>
              <select className="select" value={form.bed_id} onChange={e => set('bed_id', e.target.value)}>
                <option value="">— No bed yet —</option>
                {filteredBeds.map(b => (
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
                placeholder="Primary reason for admission…" />
            </div>
            <div className="col-span-2">
              <label className="label">Provisional Diagnosis</label>
              <input className="input" value={form.diagnosis_primary}
                onChange={e => set('diagnosis_primary', e.target.value)}
                placeholder="Provisional / working diagnosis…" />
            </div>
          </div>

          <div className="flex items-center gap-2 bg-cyan-500/10 border border-cyan-500/20 rounded-lg px-4 py-2.5 text-xs text-cyan-400">
            <Network className="w-3.5 h-3.5 shrink-0" />
            FHIR ADT A01 (Admit) message will be auto-generated and sent to HIE on admission.
          </div>

          <div className="flex gap-3 pt-1">
            <button type="submit" className="btn-primary flex items-center gap-2" disabled={saving || !form.patient_id || !form.attending_provider_id}>
              {saving ? <Spinner className="w-4 h-4" /> : <BedDouble className="w-4 h-4" />}
              Admit Patient
            </button>
            <button type="button" className="btn-secondary" onClick={() => setShowAdmit(false)}>Cancel</button>
          </div>
        </form>
      </Modal>

      {/* ── Transfer Modal ──────────────────────────────────────── */}
      <Modal open={!!showTransfer} onClose={() => setShowTransfer(null)} title="Transfer Patient" width="max-w-xl">
        {showTransfer && (
          <form onSubmit={handleTransfer} className="space-y-4">
            <ErrorBanner message={error} />
            <div className="bg-slate-800 rounded-lg px-4 py-3 text-sm">
              <p className="font-medium text-slate-200">{showTransfer.patient_name}</p>
              <p className="text-slate-500 text-xs">{showTransfer.admission_number} · {showTransfer.ward_name} · Bed {showTransfer.bed_number || '—'}</p>
            </div>

            {/* Transfer type tabs */}
            <div className="flex gap-1 bg-slate-900 border border-slate-800 rounded-lg p-1">
              {[
                { val: 'internal', label: '🏥 Internal Transfer', sub: 'Move to another ward/bed in this hospital' },
                { val: 'external', label: '🚑 External Transfer', sub: 'Refer to another hospital' },
              ].map(({ val, label, sub }) => (
                <button key={val} type="button" onClick={() => setTransferType(val)}
                  className={`flex-1 text-left px-3 py-2.5 rounded-md transition-all text-sm ${
                    transferType === val ? 'bg-slate-700 text-slate-100' : 'text-slate-500 hover:text-slate-300'
                  }`}>
                  <div className="font-medium">{label}</div>
                  <div className="text-xs opacity-60 mt-0.5">{sub}</div>
                </button>
              ))}
            </div>

            {transferType === 'internal' ? (
              <div>
                <label className="label">Destination Bed *</label>
                <select className="select" value={transferBedId} onChange={e => setTransferBedId(e.target.value)} required>
                  <option value="">Select available bed</option>
                  {beds.filter(b => b.bed_id !== showTransfer.bed_id).map(b => (
                    <option key={b.bed_id} value={b.bed_id}>
                      {b.bed_number} · {b.ward_name} ({b.bed_type})
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="label">Destination Hospital *</label>
                  <input className="input" value={transferFacility}
                    onChange={e => setTransferFacility(e.target.value)}
                    placeholder="e.g. Apollo Hospitals, Mumbai" required />
                </div>
                <div>
                  <label className="label">Hospital Address</label>
                  <input className="input" value={transferAddress}
                    onChange={e => setTransferAddress(e.target.value)}
                    placeholder="Full address (optional)" />
                </div>
              </div>
            )}

            <div>
              <label className="label">Reason for Transfer</label>
              <textarea className="input h-20 resize-none" value={transferReason}
                onChange={e => setTransferReason(e.target.value)}
                placeholder="Clinical reason / notes for transfer…" />
            </div>

            <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-lg px-4 py-2.5 text-xs text-amber-400">
              <Network className="w-3.5 h-3.5 shrink-0" />
              FHIR ADT A02 (Transfer) message will be auto-sent to HIE on completion.
            </div>

            <div className="flex gap-3">
              <button type="submit" className="btn-primary flex items-center gap-2" disabled={saving}>
                {saving ? <Spinner className="w-4 h-4" /> : <ArrowRightLeft className="w-4 h-4" />}
                Confirm Transfer
              </button>
              <button type="button" className="btn-secondary" onClick={() => setShowTransfer(null)}>Cancel</button>
            </div>
          </form>
        )}
      </Modal>

      {/* ── Discharge Modal ─────────────────────────────────────── */}
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
                placeholder="Brief discharge summary…" />
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer">
              <input type="checkbox" name="followup" className="rounded" />
              Follow-up required
            </label>
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2.5 text-xs text-red-400">
              <Network className="w-3.5 h-3.5 shrink-0" />
              FHIR ADT A03 (Discharge) message will be auto-sent to HIE.
            </div>
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
