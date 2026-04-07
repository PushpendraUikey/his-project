import { useState, useEffect, useCallback } from 'react';
import { HeartPulse, Thermometer, Wind, Activity, Plus, FileText, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';
import { api, formatDateTime, age, getVitalStatus, VITAL_STATUS_COLORS, VITAL_RANGES } from '../lib/api';
import { PageHeader, Spinner, ErrorBanner, Modal, EmptyState, StatCard } from '../components/ui';

export default function Nurse() {
  const [admissions, setAdmissions] = useState([]);
  const [nurses, setNurses]         = useState([]);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');
  const [selected, setSelected]     = useState(null);
  const [vitals, setVitals]         = useState([]);
  const [notes, setNotes]           = useState([]);
  const [detailTab, setDetailTab]   = useState('vitals');
  const [showVitals, setShowVitals] = useState(false);
  const [showNote, setShowNote]     = useState(false);
  const [saving, setSaving]         = useState(false);
  const [nurseId, setNurseId]       = useState('');
  const [vitalsForm, setVitalsForm] = useState({
    systolic_bp:'', diastolic_bp:'', heart_rate:'', temperature:'', spo2:'', respiratory_rate:'', weight_kg:'', height_cm:''
  });
  const [noteForm, setNoteForm] = useState({ note_type: 'nursing', note_content: '' });

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [adm, nrs] = await Promise.all([api.getNurseAdmissions(), api.getNurses()]);
      setAdmissions(adm); setNurses(nrs);
      if (nrs.length && !nurseId) setNurseId(nrs[0].provider_id);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [nurseId]);

  useEffect(() => { load(); }, [load]);

  async function openPatient(adm) {
    setSelected(adm); setDetailTab('vitals');
    const [v, n] = await Promise.all([api.getVitals(adm.admission_id), api.getNotes(adm.admission_id)]);
    setVitals(v); setNotes(n);
  }

  async function submitVitals(e) {
    e.preventDefault(); setSaving(true); setError('');
    try {
      const payload = { admission_id: selected.admission_id, recorded_by: nurseId };
      Object.entries(vitalsForm).forEach(([k, v]) => { if (v !== '') payload[k] = parseFloat(v); });
      await api.recordVitals(payload);
      const v = await api.getVitals(selected.admission_id);
      setVitals(v); setShowVitals(false);
      setVitalsForm({ systolic_bp:'', diastolic_bp:'', heart_rate:'', temperature:'', spo2:'', respiratory_rate:'', weight_kg:'', height_cm:'' });
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  }

  async function submitNote(e) {
    e.preventDefault(); setSaving(true); setError('');
    try {
      await api.addNote({ admission_id: selected.admission_id, author_id: nurseId, ...noteForm });
      const n = await api.getNotes(selected.admission_id);
      setNotes(n); setShowNote(false); setNoteForm({ note_type: 'nursing', note_content: '' });
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  }

  function setVF(k, v) { setVitalsForm(f => ({ ...f, [k]: v })); }

  // Check if patient is in critical condition
  const isPatientCritical = (adm) => {
    // Find the latest vitals for this admission
    const patientVitals = vitals.filter(v => v.admission_id === adm.admission_id);
    if (!patientVitals.length) return false;
    const lv = patientVitals[0];
    return (lv.spo2 < 90) || (lv.systolic_bp < 80 || lv.systolic_bp > 180) || (lv.heart_rate < 40 || lv.heart_rate > 150) || (lv.temperature > 39.5);
  };

  // Get critical patients count
  const criticalCount = admissions.filter(isPatientCritical).length;

  // Sort admissions with critical patients first
  const sortedAdmissions = [...admissions].sort((a, b) => {
    const aCritical = isPatientCritical(a);
    const bCritical = isPatientCritical(b);
    if (aCritical && !bCritical) return -1;
    if (!aCritical && bCritical) return 1;
    return 0;
  });

  const vitalIcon = (label, value, unit, vital_key) => {
    let status = 'normal';
    let statusColor = 'bg-slate-800';

    // Determine status based on vital key
    if (vital_key === 'systolic_bp' && value) {
      status = getVitalStatus('systolic_bp', value);
      statusColor = VITAL_STATUS_COLORS[status];
    } else if (vital_key === 'heart_rate' && value) {
      status = getVitalStatus('heart_rate', value);
      statusColor = VITAL_STATUS_COLORS[status];
    } else if (vital_key === 'spo2' && value) {
      status = getVitalStatus('spo2', value);
      statusColor = VITAL_STATUS_COLORS[status];
    } else if (vital_key === 'temperature' && value) {
      status = getVitalStatus('temperature', value);
      statusColor = VITAL_STATUS_COLORS[status];
    } else if (vital_key === 'respiratory_rate' && value) {
      status = getVitalStatus('respiratory_rate', value);
      statusColor = VITAL_STATUS_COLORS[status];
    }

    const textColor = status === 'critical' ? 'text-red-400' : status === 'warning' ? 'text-orange-400' : 'text-slate-100';

    return (
      <div className={`rounded-lg p-3 ${statusColor}`}>
        <p className="text-xs text-slate-500 mb-1">{label}</p>
        <p className={`text-lg font-semibold ${textColor}`}>
          {value ?? '—'} <span className="text-xs font-normal text-slate-500">{unit}</span>
        </p>
      </div>
    );
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Patient list panel */}
      <div className="w-80 border-r border-slate-800 flex flex-col bg-slate-950 overflow-hidden">
        <div className="px-4 py-4 border-b border-slate-800">
          <h2 className="font-semibold text-slate-200 mb-1">Nurse's Station</h2>
          <div className="flex items-center gap-2 mb-3">
            <p className="text-xs text-slate-500">{admissions.length} active patients</p>
            {criticalCount > 0 && (
              <span className="badge badge-red text-xs flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {criticalCount} critical
              </span>
            )}
          </div>
          <div className="mt-3">
            <label className="label">Logged in as</label>
            <select className="select text-xs" value={nurseId} onChange={e => setNurseId(e.target.value)}>
              {nurses.map(n => <option key={n.provider_id} value={n.provider_id}>{n.full_name}</option>)}
            </select>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : admissions.length === 0 ? (
            <EmptyState icon={HeartPulse} message="No active patients" />
          ) : (
            sortedAdmissions.map(a => {
              const isCritical = isPatientCritical(a);
              return (
                <button key={a.admission_id} onClick={() => openPatient(a)}
                  className={`w-full text-left px-4 py-3.5 border-b border-slate-800 hover:bg-slate-900 transition-colors ${selected?.admission_id === a.admission_id ? 'bg-slate-900 border-l-2 border-l-cyan-500' : ''}`}>
                  <div className="flex items-start justify-between mb-1">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {isCritical && (
                        <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse flex-shrink-0"></div>
                      )}
                      <p className="text-sm font-medium text-slate-200 truncate">{a.patient_name}</p>
                    </div>
                    <div className="flex items-center gap-1 ml-1 shrink-0">
                      {isCritical && (
                        <span className="badge badge-red text-xs">CRITICAL</span>
                      )}
                      <span className={`badge text-xs ${a.ward_type === 'icu' ? 'badge-red' : 'badge-gray'}`}>
                        {a.ward_type?.toUpperCase() || 'GEN'}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500">Bed {a.bed_number} · {a.ward_name}</p>
                  <p className="text-xs text-slate-600 mt-0.5">{age(a.dob)} · {a.gender}</p>
                  {a.last_vitals_at && (
                    <p className="text-xs text-emerald-600 mt-1">Vitals: {formatDateTime(a.last_vitals_at)}</p>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Detail panel */}
      <div className="flex-1 overflow-y-auto p-6">
        {!selected ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-600">
            <HeartPulse className="w-12 h-12 mb-4 opacity-30" />
            <p className="text-sm">Select a patient to view details</p>
          </div>
        ) : (
          <>
            <ErrorBanner message={error} />
            {/* Patient header */}
            <div className="card mb-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-pink-500/20 flex items-center justify-center text-pink-300 font-semibold">
                    {selected.patient_name.split(' ').map(n=>n[0]).join('').slice(0,2)}
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-slate-100">{selected.patient_name}</h2>
                    <p className="text-sm text-slate-500">{selected.mrn} · {age(selected.dob)} · {selected.gender} · {selected.blood_group || 'Unknown blood group'}</p>
                    <p className="text-xs text-slate-600 mt-0.5">Bed {selected.bed_number} · {selected.ward_name} · Dr. {selected.attending_doctor}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button className="btn-secondary flex items-center gap-1 text-xs" onClick={() => setShowNote(true)}>
                    <FileText className="w-3.5 h-3.5" /> Add Note
                  </button>
                  <button className="btn-primary flex items-center gap-1 text-xs" onClick={() => setShowVitals(true)}>
                    <Plus className="w-3.5 h-3.5" /> Record Vitals
                  </button>
                </div>
              </div>
              {selected.chief_complaint && (
                <div className="mt-3 pt-3 border-t border-slate-800">
                  <p className="text-xs text-slate-500">Chief complaint: <span className="text-slate-300">{selected.chief_complaint}</span></p>
                </div>
              )}
            </div>

            {/* Vitals Legend */}
            <div className="mb-4 p-3 bg-slate-900/50 rounded-lg border border-slate-800">
              <p className="text-xs font-medium text-slate-400 mb-2">Vital Status Legend</p>
              <div className="flex gap-4 flex-wrap text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-green-500/20 border border-green-500/50"></div>
                  <span className="text-slate-400">Normal</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-orange-500/20 border border-orange-500/50"></div>
                  <span className="text-slate-400">Warning</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-red-500/20 border border-red-500/50"></div>
                  <span className="text-slate-400">Critical</span>
                </div>
              </div>
            </div>

            {/* Latest vitals summary */}
            {vitals.length > 0 && (() => {
              const lv = vitals[0];
              return (
                <div className="mb-5">
                  <p className="section-title">Latest Vitals · {formatDateTime(lv.recorded_at)}</p>
                  <div className="grid grid-cols-4 gap-3">
                    {vitalIcon('Blood Pressure', lv.systolic_bp && lv.diastolic_bp ? `${lv.systolic_bp}/${lv.diastolic_bp}` : null, 'mmHg', 'systolic_bp')}
                    {vitalIcon('Heart Rate', lv.heart_rate, 'bpm', 'heart_rate')}
                    {vitalIcon('SpO₂', lv.spo2, '%', 'spo2')}
                    {vitalIcon('Temperature', lv.temperature, '°C', 'temperature')}
                  </div>
                </div>
              );
            })()}

            {/* Tabs */}
            <div className="flex gap-1 mb-4 bg-slate-900 border border-slate-800 rounded-lg p-1 w-fit">
              {['vitals','notes'].map(t => (
                <button key={t} onClick={() => setDetailTab(t)}
                  className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all capitalize ${
                    detailTab === t ? 'bg-slate-700 text-slate-100' : 'text-slate-500 hover:text-slate-300'
                  }`}>{t}</button>
              ))}
            </div>

            {detailTab === 'vitals' ? (
              <div className="space-y-3">
                {vitals.length === 0 ? <EmptyState icon={Activity} message="No vitals recorded yet" /> :
                  vitals.map((v, i) => (
                    <div key={v.vital_id || i} className="card-sm">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-xs text-slate-500">{formatDateTime(v.recorded_at)}</p>
                        <p className="text-xs text-slate-600">By {v.recorded_by_name || '—'}</p>
                      </div>
                      <div className="grid grid-cols-4 gap-3 text-sm">
                        {[
                          { key: 'systolic_bp', label: 'BP', value: v.systolic_bp && v.diastolic_bp ? `${v.systolic_bp}/${v.diastolic_bp} mmHg` : null },
                          { key: 'heart_rate', label: 'HR', value: v.heart_rate ? `${v.heart_rate} bpm` : null },
                          { key: 'spo2', label: 'SpO₂', value: v.spo2 ? `${v.spo2}%` : null },
                          { key: 'temperature', label: 'Temp', value: v.temperature ? `${v.temperature}°C` : null },
                          { key: 'respiratory_rate', label: 'RR', value: v.respiratory_rate ? `${v.respiratory_rate}/min` : null },
                          { key: null, label: 'Weight', value: v.weight_kg ? `${v.weight_kg} kg` : null },
                        ].map(({ key, label, value }) => {
                          if (!value) return null;

                          let statusColor = 'text-slate-300';
                          if (key) {
                            const status = getVitalStatus(key, key === 'systolic_bp' ? v.systolic_bp : key === 'heart_rate' ? v.heart_rate : key === 'spo2' ? v.spo2 : key === 'temperature' ? v.temperature : v.respiratory_rate);
                            statusColor = status === 'critical' ? 'text-red-400' : status === 'warning' ? 'text-orange-400' : 'text-green-400';
                          }

                          return (
                            <div key={label}>
                              <p className="text-xs text-slate-600">{label}</p>
                              <p className={statusColor}>{value}</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))
                }
              </div>
            ) : (
              <div className="space-y-3">
                {notes.length === 0 ? <EmptyState icon={FileText} message="No notes recorded yet" /> :
                  notes.map((n, i) => (
                    <div key={n.note_id || i} className="card-sm">
                      <div className="flex items-center justify-between mb-2">
                        <span className="badge badge-cyan capitalize">{n.note_type}</span>
                        <div className="text-right">
                          <p className="text-xs text-slate-500">{formatDateTime(n.noted_at)}</p>
                          <p className="text-xs text-slate-600">{n.author_name}</p>
                        </div>
                      </div>
                      <p className="text-sm text-slate-300 leading-relaxed">{n.note_content}</p>
                    </div>
                  ))
                }
              </div>
            )}
          </>
        )}
      </div>

      {/* Vitals modal */}
      <Modal open={showVitals} onClose={() => setShowVitals(false)} title="Record Vitals">
        <form onSubmit={submitVitals} className="space-y-4">
          <ErrorBanner message={error} />
          <div className="grid grid-cols-2 gap-4">
            {[
              ['systolic_bp','Systolic BP','mmHg'], ['diastolic_bp','Diastolic BP','mmHg'],
              ['heart_rate','Heart Rate','bpm'], ['temperature','Temperature','°C'],
              ['spo2','SpO₂','%'], ['respiratory_rate','Respiratory Rate','/min'],
              ['weight_kg','Weight','kg'], ['height_cm','Height','cm'],
            ].map(([k, label, unit]) => (
              <div key={k}>
                <label className="label">{label} <span className="text-slate-600 normal-case">({unit})</span></label>
                <input className="input" type="number" step="0.1" placeholder="—"
                  value={vitalsForm[k]} onChange={e => setVF(k, e.target.value)} />
              </div>
            ))}
          </div>
          <div className="flex gap-3 pt-1">
            <button type="submit" className="btn-primary flex items-center gap-2" disabled={saving}>
              {saving ? <Spinner className="w-4 h-4" /> : <Activity className="w-4 h-4" />}
              Save Vitals
            </button>
            <button type="button" className="btn-secondary" onClick={() => setShowVitals(false)}>Cancel</button>
          </div>
        </form>
      </Modal>

      {/* Note modal */}
      <Modal open={showNote} onClose={() => setShowNote(false)} title="Add Nursing Note">
        <form onSubmit={submitNote} className="space-y-4">
          <div>
            <label className="label">Note Type</label>
            <select className="select" value={noteForm.note_type} onChange={e => setNoteForm(f => ({ ...f, note_type: e.target.value }))}>
              {['nursing','admission','progress','transfer','discharge','lab_followup','other'].map(t => (
                <option key={t} value={t} className="capitalize">{t.replace('_',' ')}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Note Content *</label>
            <textarea required className="input h-32 resize-none" placeholder="Enter nursing note..."
              value={noteForm.note_content} onChange={e => setNoteForm(f => ({ ...f, note_content: e.target.value }))} />
          </div>
          <div className="flex gap-3">
            <button type="submit" className="btn-primary flex items-center gap-2" disabled={saving}>
              {saving ? <Spinner className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
              Save Note
            </button>
            <button type="button" className="btn-secondary" onClick={() => setShowNote(false)}>Cancel</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
