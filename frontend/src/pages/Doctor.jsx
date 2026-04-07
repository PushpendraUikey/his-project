import { useState, useEffect, useCallback } from 'react';
import { Stethoscope, FlaskConical, ClipboardList, ChevronRight, Plus, AlertCircle, Network, ArrowRightLeft, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { api, formatDateTime, age } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { PageHeader, Spinner, ErrorBanner, Modal, EmptyState, PriorityBadge } from '../components/ui';

export default function Doctor() {
  const { user } = useAuth();
  const [patients, setPatients]   = useState([]);
  const [doctors, setDoctors]     = useState([]);
  const [labTests, setLabTests]   = useState([]);
  const [availBeds, setAvailBeds] = useState([]);
  const [doctorId, setDoctorId]   = useState('');
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const [selected, setSelected]   = useState(null);
  const [context, setContext]     = useState(null);
  const [ctxLoading, setCtxLoad]  = useState(false);
  const [detailTab, setDetailTab] = useState('overview');
  const [showOrder, setShowOrder] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [saving, setSaving]       = useState(false);
  const [fhirToast, setFhirToast] = useState('');
  const [orderForm, setOrderForm] = useState({
    order_type: 'lab', notes: '', priority: 'routine', tests: [],
  });
  // Transfer form
  const [txType, setTxType]           = useState('internal');
  const [txBedId, setTxBedId]         = useState('');
  const [txFacility, setTxFacility]   = useState('');
  const [txAddress, setTxAddress]     = useState('');
  const [txReason, setTxReason]       = useState('');
  // Approval workflow
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [approvalDecision, setApprovalDecision] = useState('');
  const [approvalNotes, setApprovalNotes] = useState('');
  const [approvingSaving, setApprovingSaving] = useState(false);

  const showFhir = (msg) => { setFhirToast(msg); setTimeout(() => setFhirToast(''), 4000); };

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [pts, docs, tests, beds] = await Promise.all([
        api.getDoctorPatients(doctorId || undefined),
        api.getDoctors(),
        api.getLabTests(),
        api.getAvailableBeds(),
      ]);
      setPatients(pts); setDoctors(docs); setLabTests(tests); setAvailBeds(beds);
      if (docs.length && !doctorId) {
        // If logged-in user is a doctor, pre-select them
        const myDoc = user?.role === 'doctor'
          ? docs.find(d => d.provider_id === user.provider_id)
          : null;
        setDoctorId(myDoc?.provider_id || docs[0].provider_id);
      }
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [doctorId, user]);

  useEffect(() => { load(); }, [load]);

  async function openPatient(adm) {
    setSelected(adm); setDetailTab('overview'); setCtxLoad(true);
    try {
      setContext(await api.getPatientContext(adm.admission_id));
    } catch (e) { setError(e.message); }
    finally { setCtxLoad(false); }
  }

  async function submitOrder(e) {
    e.preventDefault(); setSaving(true); setError('');
    try {
      const order = await api.createOrder({
        admission_id: selected.admission_id,
        doctor_id: doctorId,
        ...orderForm,
      });
      setShowOrder(false);
      setOrderForm({ order_type: 'lab', notes: '', priority: 'routine', tests: [] });
      const ctx = await api.getPatientContext(selected.admission_id);
      setContext(ctx);
      // If lab order was created, no FHIR ORU yet — that fires when results are finalised
      if (orderForm.order_type === 'lab') {
        showFhir('🧪 Lab order created. FHIR ORU R01 will be sent when results are finalised.');
      }
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  }

  async function submitTransfer(e) {
    e.preventDefault(); setSaving(true); setError('');
    try {
      if (txType === 'internal') {
        if (!txBedId) { setError('Please select a destination bed.'); setSaving(false); return; }
        await api.internalTransfer({
          admission_id: selected.admission_id,
          to_bed_id: txBedId,
          reason: txReason,
          ordered_by: user?.provider_id || doctorId,
        });
      } else {
        if (!txFacility) { setError('Please enter destination facility.'); setSaving(false); return; }
        await api.externalTransfer({
          admission_id: selected.admission_id,
          to_facility_name: txFacility,
          to_facility_address: txAddress,
          reason: txReason,
          ordered_by: user?.provider_id || doctorId,
        });
      }
      // Send FHIR ADT A02
      try {
        await api.sendADTMessage({
          admission_id: selected.admission_id,
          event_type: 'TRANSFER',
          triggered_by: user?.provider_id || doctorId,
          destination: txType === 'internal' ? 'internal' : txFacility,
        });
        showFhir(`✅ FHIR ADT A02 (Transfer) sent to HIE → ${txType === 'external' ? txFacility : 'internal ward'}`);
      } catch { showFhir('⚠️ FHIR ADT message failed'); }
      setShowTransfer(false);
      setTxBedId(''); setTxFacility(''); setTxAddress(''); setTxReason('');
      // Reload patient list
      load();
      setSelected(null); setContext(null);
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  }

  async function submitApproval(e) {
    e.preventDefault(); setApprovingSaving(true); setError('');
    try {
      await api.approveDischarge({
        admission_id: selected.admission_id,
        doctor_id: user?.provider_id || doctorId,
        decision: approvalDecision,
        notes: approvalNotes,
      });
      // Refresh context to show updated approval status
      const ctx = await api.getPatientContext(selected.admission_id);
      setContext(ctx);
      // Reload patient list to update badges
      load();
      setShowApprovalModal(false);
      setApprovalDecision('');
      setApprovalNotes('');
      showFhir(`✅ Patient marked for ${approvalDecision}`);
    } catch (e) { setError(e.message); }
    finally { setApprovingSaving(false); }
  }

  const [loincSearch, setLoincSearch] = useState('');
  const [loincResults, setLoincResults] = useState([]);

  useEffect(() => {
    if (!loincSearch.trim()) { setLoincResults([]); return; }
    const t = setTimeout(async () => {
      try { setLoincResults(await api.searchLOINC(loincSearch)); } catch {}
    }, 300);
    return () => clearTimeout(t);
  }, [loincSearch]);

  function toggleLoinc(code, name) {
    setOrderForm(f => {
      const exists = f.tests.find(t => t.loincCode === code);
      return {
        ...f,
        tests: exists ? f.tests.filter(t => t.loincCode !== code) : [...f.tests, { loincCode: code, testName: name }]
      };
    });
  }

  const flagColor = { H:'text-red-400', HH:'text-red-500', L:'text-blue-400', LL:'text-blue-500', A:'text-amber-400', POS:'text-red-400', NEG:'text-emerald-400', N:'text-emerald-400' };

  // Count pending approvals (patients not yet approved)
  const pendingApprovalsCount = (patients || []).filter(p => !p.discharge_approved).length;

  return (
    <div className="flex h-screen overflow-hidden relative">
      {/* FHIR Toast */}
      {fhirToast && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 bg-slate-800 border border-cyan-500/40 text-cyan-400 text-sm rounded-xl px-5 py-3 shadow-xl">
          <Network className="w-4 h-4 shrink-0" />
          {fhirToast}
        </div>
      )}
      {/* Patient list */}
      <div className="w-80 border-r border-slate-800 flex flex-col bg-slate-950 overflow-hidden">
        <div className="px-4 py-4 border-b border-slate-800">
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-semibold text-slate-200">Doctor's View</h2>
            {pendingApprovalsCount > 0 && (
              <span className="badge badge-red text-xs">{pendingApprovalsCount} pending</span>
            )}
          </div>
          <p className="text-xs text-slate-500">{patients.length} assigned patients</p>
          <div className="mt-3">
            {user?.role === 'doctor' ? (
              <div className="text-xs text-slate-600">
                Viewing as: <span className="text-slate-300 font-medium">{user.full_name || 'You'}</span>
              </div>
            ) : (
              <>
                <label className="label">Viewing as</label>
                <select className="select text-xs" value={doctorId} onChange={e => setDoctorId(e.target.value)}>
                  <option value="">All Doctors</option>
                  {(doctors || []).map(d => <option key={d.provider_id} value={d.provider_id}>{d.full_name}</option>)}
                </select>
              </>
            )}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : (patients || []).length === 0 ? (
            <EmptyState icon={Stethoscope} message="No patients" />
          ) : (
            (patients || []).map(a => (
              <button key={a.admission_id} onClick={() => openPatient(a)}
                className={`w-full text-left px-4 py-3.5 border-b border-slate-800 hover:bg-slate-900 transition-colors ${selected?.admission_id === a.admission_id ? 'bg-slate-900 border-l-2 border-l-emerald-500' : ''}`}>
                <div className="flex items-start justify-between mb-1">
                  <p className="text-sm font-medium text-slate-200 truncate">{a.patient_name}</p>
                  <div className="flex items-center gap-1 shrink-0 ml-1">
                    {a.discharge_approved && a.discharge_decision === 'discharge' && (
                      <span className="badge badge-green text-xs">Discharge OK</span>
                    )}
                    {a.discharge_approved && a.discharge_decision === 'transfer' && (
                      <span className="badge badge-amber text-xs">Transfer OK</span>
                    )}
                    {parseInt(a.pending_orders) > 0 && (
                      <span className="badge badge-yellow text-xs">{a.pending_orders} pending</span>
                    )}
                  </div>
                </div>
                <p className="text-xs text-slate-500">Bed {a.bed_number} · {a.ward_name}</p>
                <p className="text-xs text-slate-600">{age(a.dob)} · {a.gender} · {a.mrn}</p>
                {a.chief_complaint && (
                  <p className="text-xs text-slate-600 mt-1 truncate italic">"{a.chief_complaint}"</p>
                )}
              </button>
            ))
          )}
        </div>
      </div>

      {/* Detail */}
      <div className="flex-1 overflow-y-auto p-6">
        {!selected ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-600">
            <Stethoscope className="w-12 h-12 mb-4 opacity-30" />
            <p className="text-sm">Select a patient to view full context</p>
          </div>
        ) : ctxLoading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full">
            <ErrorBanner message={error} />
            <button className="mt-4 btn-secondary" onClick={() => load()}>Retry</button>
          </div>
        ) : context ? (
          <>
            {/* Header */}
            <div className="card mb-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-300 font-semibold text-lg">
                    {(context.admission.patient_name || 'U P').split(' ').map(n=>n?.[0]||'').join('').slice(0,2)}
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-slate-100">{context.admission.patient_name}</h2>
                    <p className="text-sm text-slate-500">{context.admission.mrn} · {age(context.admission.dob)} · {context.admission.gender} · {context.admission.blood_group || 'Unknown BG'}</p>
                    <p className="text-xs text-slate-600 mt-0.5">
                      {context.admission.admission_number} · Bed {context.admission.bed_number} · {context.admission.ward_name}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button className="btn-secondary flex items-center gap-2 text-sm" onClick={() => setShowTransfer(true)}>
                    <ArrowRightLeft className="w-4 h-4" /> Transfer
                  </button>
                  <button className="btn-primary flex items-center gap-2 text-sm" onClick={() => setShowOrder(true)}>
                    <Plus className="w-4 h-4" /> Write Order
                  </button>
                </div>
              </div>
              {context.admission.chief_complaint && (
                <div className="mt-3 pt-3 border-t border-slate-800 grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="label">Chief Complaint</p>
                    <p className="text-slate-300">{context.admission.chief_complaint}</p>
                  </div>
                  {context.admission.diagnosis_primary && (
                    <div>
                      <p className="label">Diagnosis</p>
                      <p className="text-slate-300">{context.admission.diagnosis_primary}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Approval Status Section */}
              <div className="mt-4 pt-4 border-t border-slate-800">
                {context.admission.discharge_approved ? (
                  <div className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-4 py-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-emerald-300">
                        Approved for {context.admission.discharge_decision === 'transfer' ? 'Transfer' : 'Discharge'}
                      </p>
                      <p className="text-xs text-emerald-300/70 mt-0.5">
                        By Dr. {context.admission.discharge_approved_by_doctor} on {formatDateTime(context.admission.discharge_approved_at)}
                      </p>
                      {context.admission.discharge_notes && (
                        <p className="text-xs text-emerald-300/60 mt-1 italic">{context.admission.discharge_notes}</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm font-medium text-slate-400">Awaiting Approval Decision</p>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => { setApprovalDecision('discharge'); setShowApprovalModal(true); }}
                        className="btn-sm bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/30 flex items-center justify-center gap-2 py-2"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span className="text-xs">Approve Discharge</span>
                      </button>
                      <button
                        onClick={() => { setApprovalDecision('transfer'); setShowApprovalModal(true); }}
                        className="btn-sm bg-amber-500/20 border border-amber-500/30 text-amber-300 hover:bg-amber-500/30 flex items-center justify-center gap-2 py-2"
                      >
                        <ArrowRightLeft className="w-4 h-4" />
                        <span className="text-xs">Approve Transfer</span>
                      </button>
                      <button
                        onClick={() => { setApprovalDecision('continue'); setShowApprovalModal(true); }}
                        className="btn-sm bg-blue-500/20 border border-blue-500/30 text-blue-300 hover:bg-blue-500/30 flex items-center justify-center gap-2 py-2"
                      >
                        <Clock className="w-4 h-4" />
                        <span className="text-xs">Continue Stay</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Latest vitals strip */}
            {(context.vitals || []).length > 0 && (() => {
              const v = context.vitals[0];
              return (
                <div className="grid grid-cols-5 gap-3 mb-5">
                  {[
                    ['BP', v.systolic_bp && v.diastolic_bp ? `${v.systolic_bp}/${v.diastolic_bp}` : '—', 'mmHg'],
                    ['HR', v.heart_rate, 'bpm'],
                    ['SpO₂', v.spo2, '%'],
                    ['Temp', v.temperature, '°C'],
                    ['RR', v.respiratory_rate, '/min'],
                  ].map(([l, val, unit]) => (
                    <div key={l} className="bg-slate-800 rounded-lg p-3 text-center">
                      <p className="text-xs text-slate-500 mb-1">{l}</p>
                      <p className="font-semibold text-slate-100">{val ?? '—'}</p>
                      <p className="text-xs text-slate-600">{unit}</p>
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* Tabs */}
            <div className="flex gap-1 mb-4 bg-slate-900 border border-slate-800 rounded-lg p-1 w-fit">
              {['overview','orders','labs','notes'].map(t => (
                <button key={t} onClick={() => setDetailTab(t)}
                  className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all capitalize ${
                    detailTab === t ? 'bg-slate-700 text-slate-100' : 'text-slate-500 hover:text-slate-300'
                  }`}>{t}</button>
              ))}
            </div>

            {detailTab === 'overview' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="card">
                  <p className="section-title">Recent Vitals</p>
                  {(context.vitals || []).slice(0,3).map((v,i) => (
                    <div key={i} className="text-xs text-slate-500 border-b border-slate-800 py-2 last:border-0">
                      <span className="text-slate-400">{formatDateTime(v.recorded_at)}</span>
                      {v.systolic_bp && <span className="ml-2">BP {v.systolic_bp}/{v.diastolic_bp}</span>}
                      {v.heart_rate && <span className="ml-2">HR {v.heart_rate}</span>}
                      {v.spo2 && <span className="ml-2">SpO₂ {v.spo2}%</span>}
                    </div>
                  ))}
                  {(context.vitals || []).length === 0 && <p className="text-xs text-slate-600">No vitals yet</p>}
                </div>
                <div className="card">
                  <p className="section-title">Recent Notes</p>
                  {(context.notes || []).slice(0,3).map((n,i) => (
                    <div key={i} className="text-xs border-b border-slate-800 py-2 last:border-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="badge badge-cyan capitalize">{n.note_type}</span>
                        <span className="text-slate-600">{n.author}</span>
                      </div>
                      <p className="text-slate-400 line-clamp-2">{n.note_content}</p>
                    </div>
                  ))}
                  {(context.notes || []).length === 0 && <p className="text-xs text-slate-600">No notes yet</p>}
                </div>
              </div>
            )}

            {detailTab === 'orders' && (
              <div className="space-y-3">
                {(context.orders || []).length === 0 ? <EmptyState icon={ClipboardList} message="No orders placed yet" /> :
                  (context.orders || []).map((o, i) => (
                    <div key={o.order_id || i} className="card-sm flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="badge badge-blue capitalize">{o.order_type}</span>
                          <span className={`badge ${o.status === 'completed' ? 'badge-green' : o.status === 'cancelled' ? 'badge-red' : 'badge-yellow'} capitalize`}>{o.status}</span>
                        </div>
                        {o.notes && <p className="text-xs text-slate-400">{o.notes}</p>}
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-slate-500">{formatDateTime(o.created_at)}</p>
                        <p className="text-xs text-slate-600">{o.doctor_name}</p>
                      </div>
                    </div>
                  ))
                }
              </div>
            )}

            {detailTab === 'labs' && (
              <div className="space-y-4">
                {(context.labs || []).length === 0 ? <EmptyState icon={FlaskConical} message="No lab orders yet" /> :
                  (context.labs || []).map((l, i) => (
                    <div key={i} className="card-sm">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-cyan-400">{l.order_number}</span>
                          <PriorityBadge priority={l.priority} />
                        </div>
                        <span className={`badge ${l.order_status === 'resulted' ? 'badge-green' : 'badge-yellow'} capitalize`}>{l.order_status}</span>
                      </div>
                      <div className="space-y-2">
                        {(l.tests || []).filter(t => t && t.test_name).map((t, j) => (
                          <div key={j} className="flex items-center justify-between text-sm bg-slate-800 rounded px-3 py-2">
                            <div>
                              <span className="text-slate-300">{t.test_name}</span>
                              {t.loinc_code && (
                                <span className="ml-2 font-mono text-xs text-cyan-600">{t.loinc_code}</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              {(t.result !== null && t.result !== undefined) ? (
                                <span className={`font-mono font-medium ${flagColor[t.flag] || 'text-slate-200'}`}>
                                  {t.result} {t.unit}
                                </span>
                              ) : t.text_value ? (
                                <span className="text-slate-300 text-xs">{t.text_value}</span>
                              ) : null}
                              {t.flag && <span className={`text-xs font-bold ${flagColor[t.flag] || ''}`}>{t.flag}</span>}
                              <span className={`badge ${t.status === 'resulted' ? 'badge-green' : 'badge-gray'} text-xs`}>{t.status}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                }
              </div>
            )}

            {detailTab === 'notes' && (
              <div className="space-y-3">
                {(context.notes || []).length === 0 ? <EmptyState icon={ClipboardList} message="No notes yet" /> :
                  (context.notes || []).map((n, i) => (
                    <div key={i} className="card-sm">
                      <div className="flex items-center justify-between mb-2">
                        <span className="badge badge-cyan capitalize">{n.note_type}</span>
                        <div className="text-right">
                          <p className="text-xs text-slate-500">{formatDateTime(n.noted_at)}</p>
                          <p className="text-xs text-slate-600">{n.author}</p>
                        </div>
                      </div>
                      <p className="text-sm text-slate-300 leading-relaxed">{n.note_content}</p>
                    </div>
                  ))
                }
              </div>
            )}
          </>
        ) : null}
      </div>

      {/* Write Order modal */}
      <Modal open={showOrder} onClose={() => setShowOrder(false)} title="Write Order" width="max-w-2xl">
        <form onSubmit={submitOrder} className="space-y-5">
          <ErrorBanner message={error} />
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Order Type</label>
              <select className="select" value={orderForm.order_type}
                onChange={e => setOrderForm(f => ({ ...f, order_type: e.target.value, tests: [] }))}>
                {['lab','admit','discharge','transfer'].map(t => (
                  <option key={t} value={t} className="capitalize">{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Priority</label>
              <select className="select" value={orderForm.priority}
                onChange={e => setOrderForm(f => ({ ...f, priority: e.target.value }))}>
                <option value="routine">Routine</option>
                <option value="stat">STAT</option>
                <option value="critical">Critical</option>
              </select>
            </div>
          </div>

          {orderForm.order_type === 'lab' && (
            <div>
              <label className="label">Search LOINC Tests</label>
              <input className="input mb-2" placeholder="Search by name, code..." value={loincSearch} onChange={e => setLoincSearch(e.target.value)} />
              {loincResults.length > 0 && (
                <div className="bg-slate-800 border border-slate-700 rounded-lg max-h-40 overflow-y-auto mb-3">
                  {loincResults.map(t => (
                    <button key={t.loinc_num} type="button" onClick={() => { toggleLoinc(t.loinc_num, t.name || t.short_name); setLoincSearch(''); setLoincResults([]); }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-slate-700 text-slate-300">
                      <span className="font-mono text-cyan-400 mr-2">{t.loinc_num}</span>
                      {t.name || t.short_name}
                    </button>
                  ))}
                </div>
              )}
              {orderForm.tests.length > 0 && (
                <div className="space-y-1 mt-2">
                  <p className="text-xs text-slate-500 mb-2">Selected Tests:</p>
                  {orderForm.tests.map(t => (
                    <div key={t.loincCode} className="flex justify-between items-center text-sm bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 px-3 py-2 rounded-lg">
                      <span><span className="font-mono text-xs opacity-70 mr-2">{t.loincCode}</span>{t.testName}</span>
                      <button type="button" onClick={() => toggleLoinc(t.loincCode, t.testName)} className="text-emerald-400 hover:text-emerald-200">
                        <XCircle className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div>
            <label className="label">Clinical Notes</label>
            <textarea className="input h-24 resize-none" placeholder="Order notes or instructions..."
              value={orderForm.notes} onChange={e => setOrderForm(f => ({ ...f, notes: e.target.value }))} />
          </div>

          <div className="flex gap-3">
            <button type="submit" className="btn-primary flex items-center gap-2" disabled={saving}>
              {saving ? <Spinner className="w-4 h-4" /> : <ClipboardList className="w-4 h-4" />}
              Place Order
            </button>
            <button type="button" className="btn-secondary" onClick={() => setShowOrder(false)}>Cancel</button>
          </div>
        </form>
      </Modal>

      {/* Transfer Modal */}
      <Modal open={showTransfer} onClose={() => setShowTransfer(false)} title="Suggest Patient Transfer" width="max-w-xl">
        {selected && (
          <form onSubmit={submitTransfer} className="space-y-4">
            <ErrorBanner message={error} />
            <div className="bg-slate-800 rounded-lg px-4 py-3 text-sm">
              <p className="font-medium text-slate-200">{selected.patient_name}</p>
              <p className="text-slate-500 text-xs">{selected.mrn} · Bed {selected.bed_number} · {selected.ward_name}</p>
            </div>

            <div className="flex gap-1 bg-slate-900 border border-slate-800 rounded-lg p-1">
              {[
                { val: 'internal', label: '🏥 Internal Transfer' },
                { val: 'external', label: '🚑 External Referral' },
              ].map(({ val, label }) => (
                <button key={val} type="button" onClick={() => setTxType(val)}
                  className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                    txType === val ? 'bg-slate-700 text-slate-100' : 'text-slate-500 hover:text-slate-300'
                  }`}>{label}</button>
              ))}
            </div>

            {txType === 'internal' ? (
              <div>
                <label className="label">Destination Bed *</label>
                <select className="select" value={txBedId} onChange={e => setTxBedId(e.target.value)} required>
                  <option value="">Select available bed</option>
                  {availBeds.map(b => (
                    <option key={b.bed_id} value={b.bed_id}>{b.bed_number} · {b.ward_name} ({b.bed_type})</option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="label">Destination Hospital *</label>
                  <input className="input" value={txFacility} onChange={e => setTxFacility(e.target.value)}
                    placeholder="e.g. Apollo Hospitals, Mumbai" required />
                </div>
                <div>
                  <label className="label">Hospital Address</label>
                  <input className="input" value={txAddress} onChange={e => setTxAddress(e.target.value)}
                    placeholder="Full address (optional)" />
                </div>
              </div>
            )}

            <div>
              <label className="label">Clinical Reason for Transfer</label>
              <textarea className="input h-20 resize-none" value={txReason}
                onChange={e => setTxReason(e.target.value)}
                placeholder="Clinical indication / reason for transfer…" />
            </div>

            <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-lg px-4 py-2.5 text-xs text-amber-400">
              <Network className="w-3.5 h-3.5 shrink-0" />
              FHIR ADT A02 (Transfer) message will be auto-sent to HIE on confirmation.
              {txType === 'external' && ' External bundle includes full patient summary.'}
            </div>

            <div className="flex gap-3">
              <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2">
                {saving ? <Spinner className="w-4 h-4" /> : <ArrowRightLeft className="w-4 h-4" />}
                Confirm Transfer
              </button>
              <button type="button" className="btn-secondary" onClick={() => setShowTransfer(false)}>Cancel</button>
            </div>
          </form>
        )}
      </Modal>

      {/* Approval Modal */}
      <Modal open={showApprovalModal} onClose={() => setShowApprovalModal(false)} title={`Approve ${approvalDecision === 'discharge' ? 'Discharge' : approvalDecision === 'transfer' ? 'Transfer' : 'Continue Stay'}`} width="max-w-md">
        {selected && (
          <form onSubmit={submitApproval} className="space-y-4">
            <ErrorBanner message={error} />
            <div className="bg-slate-800 rounded-lg px-4 py-3 text-sm">
              <p className="font-medium text-slate-200">{selected.patient_name}</p>
              <p className="text-slate-500 text-xs">{selected.mrn}</p>
            </div>

            <div>
              <label className="label">Reason / Notes</label>
              <textarea className="input h-24 resize-none" placeholder="Clinical reason or notes for this decision..."
                value={approvalNotes} onChange={e => setApprovalNotes(e.target.value)} />
            </div>

            <div className="flex gap-3">
              <button type="submit" disabled={approvingSaving} className="btn-primary flex items-center gap-2 flex-1">
                {approvingSaving ? <Spinner className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                Confirm
              </button>
              <button type="button" className="btn-secondary flex-1" onClick={() => setShowApprovalModal(false)}>Cancel</button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
