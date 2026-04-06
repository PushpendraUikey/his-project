import { useState, useEffect, useCallback } from 'react';
import { Stethoscope, FlaskConical, ClipboardList, ChevronRight, Plus, AlertCircle } from 'lucide-react';
import { api, formatDateTime, age } from '../lib/api';
import { PageHeader, Spinner, ErrorBanner, Modal, EmptyState, PriorityBadge } from '../components/ui';

export default function Doctor() {
  const [patients, setPatients]   = useState([]);
  const [doctors, setDoctors]     = useState([]);
  const [labTests, setLabTests]   = useState([]);
  const [doctorId, setDoctorId]   = useState('');
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const [selected, setSelected]   = useState(null);
  const [context, setContext]     = useState(null);
  const [ctxLoading, setCtxLoad]  = useState(false);
  const [detailTab, setDetailTab] = useState('overview');
  const [showOrder, setShowOrder] = useState(false);
  const [saving, setSaving]       = useState(false);
  const [orderForm, setOrderForm] = useState({
    order_type: 'lab', notes: '', priority: 'routine', tests: [],
  });

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [pts, docs, tests] = await Promise.all([
        api.getDoctorPatients(doctorId || undefined),
        api.getDoctors(),
        api.getLabTests(),
      ]);
      setPatients(pts); setDoctors(docs); setLabTests(tests);
      if (docs.length && !doctorId) setDoctorId(docs[0].provider_id);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [doctorId]);

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
      await api.createOrder({
        admission_id: selected.admission_id,
        doctor_id: doctorId,
        ...orderForm,
      });
      setShowOrder(false);
      setOrderForm({ order_type: 'lab', notes: '', priority: 'routine', tests: [] });
      const ctx = await api.getPatientContext(selected.admission_id);
      setContext(ctx);
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  }

  function toggleTest(id) {
    setOrderForm(f => ({
      ...f,
      tests: f.tests.includes(id) ? f.tests.filter(t => t !== id) : [...f.tests, id],
    }));
  }

  const grouped = labTests.reduce((acc, t) => {
    (acc[t.category] = acc[t.category] || []).push(t);
    return acc;
  }, {});

  const flagColor = { H:'text-red-400', HH:'text-red-500', L:'text-blue-400', LL:'text-blue-500', A:'text-amber-400', POS:'text-red-400', NEG:'text-emerald-400', N:'text-emerald-400' };

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Patient list */}
      <div className="w-80 border-r border-slate-800 flex flex-col bg-slate-950 overflow-hidden">
        <div className="px-4 py-4 border-b border-slate-800">
          <h2 className="font-semibold text-slate-200 mb-1">Doctor's View</h2>
          <p className="text-xs text-slate-500">{patients.length} assigned patients</p>
          <div className="mt-3">
            <label className="label">Viewing as</label>
            <select className="select text-xs" value={doctorId} onChange={e => setDoctorId(e.target.value)}>
              <option value="">All Doctors</option>
              {doctors.map(d => <option key={d.provider_id} value={d.provider_id}>{d.full_name}</option>)}
            </select>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : patients.length === 0 ? (
            <EmptyState icon={Stethoscope} message="No patients" />
          ) : (
            patients.map(a => (
              <button key={a.admission_id} onClick={() => openPatient(a)}
                className={`w-full text-left px-4 py-3.5 border-b border-slate-800 hover:bg-slate-900 transition-colors ${selected?.admission_id === a.admission_id ? 'bg-slate-900 border-l-2 border-l-emerald-500' : ''}`}>
                <div className="flex items-start justify-between mb-1">
                  <p className="text-sm font-medium text-slate-200 truncate">{a.patient_name}</p>
                  {parseInt(a.pending_orders) > 0 && (
                    <span className="badge badge-yellow text-xs ml-1 shrink-0">{a.pending_orders} pending</span>
                  )}
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
        ) : context ? (
          <>
            <ErrorBanner message={error} />
            {/* Header */}
            <div className="card mb-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-300 font-semibold text-lg">
                    {context.admission.patient_name.split(' ').map(n=>n[0]).join('').slice(0,2)}
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-slate-100">{context.admission.patient_name}</h2>
                    <p className="text-sm text-slate-500">{context.admission.mrn} · {age(context.admission.dob)} · {context.admission.gender} · {context.admission.blood_group || 'Unknown BG'}</p>
                    <p className="text-xs text-slate-600 mt-0.5">
                      {context.admission.admission_number} · Bed {context.admission.bed_number} · {context.admission.ward_name}
                    </p>
                  </div>
                </div>
                <button className="btn-primary flex items-center gap-2 text-sm" onClick={() => setShowOrder(true)}>
                  <Plus className="w-4 h-4" /> Write Order
                </button>
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
            </div>

            {/* Latest vitals strip */}
            {context.vitals.length > 0 && (() => {
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
                  {context.vitals.slice(0,3).map((v,i) => (
                    <div key={i} className="text-xs text-slate-500 border-b border-slate-800 py-2 last:border-0">
                      <span className="text-slate-400">{formatDateTime(v.recorded_at)}</span>
                      {v.systolic_bp && <span className="ml-2">BP {v.systolic_bp}/{v.diastolic_bp}</span>}
                      {v.heart_rate && <span className="ml-2">HR {v.heart_rate}</span>}
                      {v.spo2 && <span className="ml-2">SpO₂ {v.spo2}%</span>}
                    </div>
                  ))}
                  {context.vitals.length === 0 && <p className="text-xs text-slate-600">No vitals yet</p>}
                </div>
                <div className="card">
                  <p className="section-title">Recent Notes</p>
                  {context.notes.slice(0,3).map((n,i) => (
                    <div key={i} className="text-xs border-b border-slate-800 py-2 last:border-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="badge badge-cyan capitalize">{n.note_type}</span>
                        <span className="text-slate-600">{n.author}</span>
                      </div>
                      <p className="text-slate-400 line-clamp-2">{n.note_content}</p>
                    </div>
                  ))}
                  {context.notes.length === 0 && <p className="text-xs text-slate-600">No notes yet</p>}
                </div>
              </div>
            )}

            {detailTab === 'orders' && (
              <div className="space-y-3">
                {context.orders.length === 0 ? <EmptyState icon={ClipboardList} message="No orders placed yet" /> :
                  context.orders.map((o, i) => (
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
                {context.labs.length === 0 ? <EmptyState icon={FlaskConical} message="No lab orders yet" /> :
                  context.labs.map((l, i) => (
                    <div key={i} className="card-sm">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-cyan-400">{l.order_number}</span>
                          <PriorityBadge priority={l.priority} />
                        </div>
                        <span className={`badge ${l.order_status === 'resulted' ? 'badge-green' : 'badge-yellow'} capitalize`}>{l.order_status}</span>
                      </div>
                      <div className="space-y-2">
                        {l.tests?.map((t, j) => (
                          <div key={j} className="flex items-center justify-between text-sm bg-slate-800 rounded px-3 py-2">
                            <span className="text-slate-300">{t.test_name}</span>
                            <div className="flex items-center gap-2">
                              {t.result !== null && t.result !== undefined && (
                                <span className={`font-mono font-medium ${flagColor[t.flag] || 'text-slate-200'}`}>
                                  {t.result} {t.unit}
                                </span>
                              )}
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
                {context.notes.length === 0 ? <EmptyState icon={ClipboardList} message="No notes yet" /> :
                  context.notes.map((n, i) => (
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
              <label className="label">Select Tests</label>
              <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                {Object.entries(grouped).map(([cat, tests]) => (
                  <div key={cat}>
                    <p className="text-xs text-slate-600 uppercase tracking-wider mb-1.5">{cat.replace('_',' ')}</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {tests.map(t => (
                        <label key={t.test_definition_id}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer text-sm transition-colors ${
                            orderForm.tests.includes(t.test_definition_id)
                              ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'
                              : 'bg-slate-800 border border-transparent text-slate-400 hover:text-slate-300'
                          }`}>
                          <input type="checkbox" className="hidden"
                            checked={orderForm.tests.includes(t.test_definition_id)}
                            onChange={() => toggleTest(t.test_definition_id)} />
                          <span className="font-mono text-xs">{t.test_code}</span>
                          <span className="truncate">{t.test_name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              {orderForm.tests.length > 0 && (
                <p className="text-xs text-emerald-400 mt-2">{orderForm.tests.length} test(s) selected</p>
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
    </div>
  );
}
