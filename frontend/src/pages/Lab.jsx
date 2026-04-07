import { useState, useEffect, useCallback } from 'react';
import { FlaskConical, CheckCircle, Clock, AlertTriangle, Beaker, Plus, Network } from 'lucide-react';
import { api, formatDateTime, age } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { PageHeader, Spinner, ErrorBanner, Modal, EmptyState, PriorityBadge, StatCard } from '../components/ui';

export default function Lab() {
  const { user } = useAuth();
  const [orders, setOrders]         = useState([]);
  const [technicians, setTechs]     = useState([]);
  const [machines, setMachines]     = useState([]);
  const [techId, setTechId]         = useState('');
  const [statusFilter, setFilter]   = useState('pending');
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');
  const [selected, setSelected]     = useState(null);
  const [showCollect, setShowCollect] = useState(null);
  const [showResult, setShowResult] = useState(null);
  const [saving, setSaving]         = useState(false);
  const [fhirToast, setFhirToast]   = useState('');
  const [resultForm, setResultForm] = useState({
    numeric_value: '', text_value: '', unit: '', reference_range_low: '',
    reference_range_high: '', abnormal_flag: '', is_critical: false,
  });

  const showFhir = (msg) => { setFhirToast(msg); setTimeout(() => setFhirToast(''), 5000); };

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [ord, techs, macs] = await Promise.all([api.getLabOrders(statusFilter), api.getTechnicians(), api.getLabMachines()]);
      setOrders(ord); setTechs(techs); setMachines(macs);
      if (techs.length && !techId) setTechId(techs[0].provider_id);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [statusFilter, techId]);

  useEffect(() => { load(); }, [load]);

  async function handleCollect(e) {
    e.preventDefault(); setSaving(true); setError('');
    const fd = new FormData(e.target);
    try {
      await api.collectSpecimen(showCollect.lab_order_id, {
        collected_by: technicians.find(t => t.provider_id === techId)?.full_name || 'Lab Tech',
        specimen_type: fd.get('specimen_type'),
      });
      setShowCollect(null); load();
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  }

  async function handleResult(e) {
    e.preventDefault(); setSaving(true); setError('');
    try {
      await api.enterResult({
        order_test_id: showResult.test.order_test_id,
        lab_order_id: showResult.order.lab_order_id,
        validated_by: techId,
        ...resultForm,
        numeric_value: resultForm.numeric_value ? parseFloat(resultForm.numeric_value) : null,
        is_critical: resultForm.is_critical,
      });
      setShowResult(null);
      setResultForm({ numeric_value:'', text_value:'', unit:'', reference_range_low:'', reference_range_high:'', abnormal_flag:'', is_critical:false });

      // Refresh orders then check if all tests resulted
      await load();
      const refreshed = orders.find(o => o.lab_order_id === showResult.order.lab_order_id);
      const allDone = refreshed?.tests?.every(t => t.status === 'resulted');

      if (allDone) {
        // Send FHIR ORU R01 to HIE
        try {
          await api.sendLabResultMessage({
            lab_order_id: showResult.order.lab_order_id,
            triggered_by: user?.provider_id || techId,
          });
          showFhir(`✅ FHIR ORU R01 (Lab Results) sent to HIE — ${showResult.order.order_number}`);
        } catch { showFhir('⚠️ FHIR ORU R01 failed to send'); }
      } else {
        showFhir(`🧪 Result saved — ${refreshed?.tests?.filter(t => t.status === 'resulted').length || '?'} / ${refreshed?.tests?.length || '?'} tests done`);
      }

    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  }

  const [showProcess, setShowProcess] = useState(null);
  const [procMachine, setProcMachine] = useState('');

  async function handleProcess(e) {
    e.preventDefault(); setSaving(true); setError('');
    try {
      await api.processOnMachine(showProcess.lab_order_id, { machine_id: procMachine });
      setShowProcess(null); load();
      showFhir('⚙️ Order sent to machine. Simulation started (3s)...');
      setTimeout(load, 3500); // refresh after simulation
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  }

  function setRF(k, v) { setResultForm(f => ({ ...f, [k]: v })); }

  const pendingCount   = orders.filter(o => o.order_status === 'pending').length;
  const collectCount   = orders.filter(o => o.order_status === 'collected').length;
  const processingCount= orders.filter(o => o.order_status === 'processing').length;
  const criticalCount  = orders.filter(o => o.priority === 'critical' || o.priority === 'stat').length;

  const statusTabs = [
    { key: 'pending',    label: 'Pending' },
    { key: 'collected',  label: 'Collected' },
    { key: 'processing', label: 'Processing' },
    { key: 'resulted',   label: 'Resulted' },
  ];

  return (
    <div className="flex h-screen overflow-hidden relative">
      {/* FHIR Toast */}
      {fhirToast && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 bg-slate-800 border border-violet-500/40 text-violet-400 text-sm rounded-xl px-5 py-3 shadow-xl">
          <Network className="w-4 h-4 shrink-0" />
          {fhirToast}
        </div>
      )}
      {/* Left: Order list */}
      <div className="w-96 border-r border-slate-800 flex flex-col bg-slate-950 overflow-hidden">
        <div className="px-4 py-4 border-b border-slate-800">
          <h2 className="font-semibold text-slate-200 mb-1">Laboratory</h2>
          <div className="mt-3">
            <label className="label">Technician</label>
            <select className="select text-xs" value={techId} onChange={e => setTechId(e.target.value)}>
              {technicians.map(t => <option key={t.provider_id} value={t.provider_id}>{t.full_name}</option>)}
            </select>
          </div>
        </div>

        {/* Status filter tabs */}
        <div className="grid grid-cols-4 gap-px bg-slate-800 border-b border-slate-800">
          {statusTabs.map(({ key, label }) => (
            <button key={key} onClick={() => { setFilter(key); setSelected(null); }}
              className={`py-2 text-xs font-medium transition-colors ${
                statusFilter === key
                  ? 'bg-slate-900 text-cyan-400'
                  : 'bg-slate-950 text-slate-600 hover:text-slate-400'
              }`}>{label}</button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : orders.length === 0 ? (
            <EmptyState icon={FlaskConical} message={`No ${statusFilter} orders`} />
          ) : (
            orders.map(o => (
              <button key={o.lab_order_id} onClick={() => setSelected(o)}
                className={`w-full text-left px-4 py-3.5 border-b border-slate-800 hover:bg-slate-900 transition-colors ${selected?.lab_order_id === o.lab_order_id ? 'bg-slate-900 border-l-2 border-l-amber-500' : ''}`}>
                <div className="flex items-start justify-between mb-1">
                  <p className="text-sm font-medium text-slate-200 truncate">{o.patient_name}</p>
                  <PriorityBadge priority={o.priority} />
                </div>
                <p className="font-mono text-xs text-amber-400">{o.order_number}</p>
                <p className="text-xs text-slate-500 mt-0.5">{o.ward_name} · Bed {o.bed_number}</p>
                <p className="text-xs text-slate-600">
                  {o.tests?.length} test{o.tests?.length !== 1 ? 's' : ''} · Ordered {formatDateTime(o.ordered_at)}
                </p>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Right: Detail */}
      <div className="flex-1 overflow-y-auto p-6">
        {!selected ? (
          <>
            <PageHeader title="Laboratory Module" subtitle="Manage specimen collection and result entry" />
            <ErrorBanner message={error} />
            <div className="grid grid-cols-4 gap-4 mb-6">
              <StatCard label="Pending Orders" value={pendingCount} color="text-amber-400" />
              <StatCard label="Collected" value={collectCount} color="text-blue-400" />
              <StatCard label="Processing" value={processingCount} color="text-cyan-400" />
              <StatCard label="Urgent / STAT" value={criticalCount} color="text-red-400" />
            </div>
            <div className="flex flex-col items-center justify-center py-16 text-slate-600">
              <Beaker className="w-12 h-12 mb-4 opacity-30" />
              <p className="text-sm">Select an order from the list to begin</p>
            </div>
          </>
        ) : (
          <>
            <ErrorBanner message={error} />
            {/* Order header */}
            <div className="card mb-5">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-mono text-sm text-amber-400">{selected.order_number}</span>
                    <PriorityBadge priority={selected.priority} />
                    <span className={`badge capitalize ${
                      selected.order_status === 'resulted'   ? 'badge-green' :
                      selected.order_status === 'processing' ? 'badge-cyan'  :
                      selected.order_status === 'collected'  ? 'badge-blue'  : 'badge-yellow'
                    }`}>{selected.order_status}</span>
                  </div>
                  <h2 className="text-lg font-semibold text-slate-100">{selected.patient_name}</h2>
                  <p className="text-sm text-slate-500">
                    {selected.mrn} · {age(selected.dob)} · Ward {selected.ward_name} · Bed {selected.bed_number}
                  </p>
                  <p className="text-xs text-slate-600 mt-1">
                    Ordered by Dr. {selected.ordering_doctor} · {formatDateTime(selected.ordered_at)}
                  </p>
                </div>
                <div className="flex gap-2">
                  {selected.order_status === 'pending' && (
                    <button className="btn-secondary flex items-center gap-1.5 text-sm"
                      onClick={() => setShowCollect(selected)}>
                      <CheckCircle className="w-4 h-4 text-emerald-400" /> Mark Collected
                    </button>
                  )}
                  {selected.order_status === 'collected' && (
                    <button className="btn-primary flex items-center gap-1.5 text-sm"
                      onClick={() => setShowProcess(selected)}>
                      <Beaker className="w-4 h-4" /> Process on Machine
                    </button>
                  )}
                </div>
              </div>
              {selected.collected_at && (
                <div className="mt-3 pt-3 border-t border-slate-800 text-xs text-slate-500">
                  Collected: {formatDateTime(selected.collected_at)} by {selected.collected_by || '—'} · Specimen: {selected.specimen_type || '—'}
                </div>
              )}
            </div>

            {/* Tests */}
            <p className="section-title">Tests ({selected.tests?.length})</p>
            <div className="space-y-3">
              {selected.tests?.map((t, i) => (
                <div key={t.order_test_id || i}
                  className={`card-sm flex items-center justify-between ${
                    t.status === 'resulted' ? 'border-emerald-500/20' : ''
                  }`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${
                      t.status === 'resulted' ? 'bg-emerald-400' : 'bg-slate-600'
                    }`} />
                    <div>
                      <p className="text-sm font-medium text-slate-200">{t.test_name}</p>
                      <p className="text-xs text-slate-500">{t.test_code}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`badge text-xs capitalize ${t.status === 'resulted' ? 'badge-green' : 'badge-gray'}`}>
                      {t.status}
                    </span>
                    {t.status !== 'resulted' && selected.order_status !== 'pending' && (
                      <button className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1"
                        onClick={() => setShowResult({ order: selected, test: t })}>
                        <Plus className="w-3 h-3" /> Enter Result
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Collect specimen modal */}
      <Modal open={!!showCollect} onClose={() => setShowCollect(null)} title="Mark Specimen Collected">
        {showCollect && (
          <form onSubmit={handleCollect} className="space-y-4">
            <div className="bg-slate-800 rounded-lg px-4 py-3 text-sm">
              <p className="font-medium text-slate-200">{showCollect.patient_name}</p>
              <p className="text-slate-500 text-xs">{showCollect.order_number}</p>
            </div>
            <div>
              <label className="label">Specimen Type *</label>
              <select name="specimen_type" className="select" required>
                {['Whole Blood (EDTA)','Serum','Whole Blood','Citrated Plasma','Mid-stream Urine','Nasopharyngeal Swab'].map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-3">
              <button type="submit" className="btn-primary flex items-center gap-2" disabled={saving}>
                {saving ? <Spinner className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                Confirm Collection
              </button>
              <button type="button" className="btn-secondary" onClick={() => setShowCollect(null)}>Cancel</button>
            </div>
          </form>
        )}
      </Modal>

      {/* Process on Machine Modal */}
      <Modal open={!!showProcess} onClose={() => setShowProcess(null)} title="Process on Lab Machine">
        {showProcess && (
          <form onSubmit={handleProcess} className="space-y-4">
            <div className="bg-slate-800 rounded-lg px-4 py-3 text-sm">
              <p className="font-medium text-slate-200">Order {showProcess.order_number}</p>
              <p className="text-slate-500 text-xs">For {showProcess.patient_name}</p>
            </div>
            <div>
              <label className="label">Select Machine</label>
              <select className="select" value={procMachine} onChange={e => setProcMachine(e.target.value)} required>
                <option value="">-- Choose Machine --</option>
                {machines.map(m => (
                  <option key={m.id} value={m.id}>{m.name} ({m.type})</option>
                ))}
                {machines.length === 0 && <option value="1">Simulated Machine 1</option>}
              </select>
            </div>
            <div className="flex gap-3 mt-4">
              <button type="submit" className="btn-primary flex items-center gap-2" disabled={saving}>
                {saving ? <Spinner className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                Start Processing (3s delay)
              </button>
              <button type="button" className="btn-secondary" onClick={() => setShowProcess(null)}>Cancel</button>
            </div>
          </form>
        )}
      </Modal>

      {/* Enter result modal */}
      <Modal open={!!showResult} onClose={() => setShowResult(null)} title="Enter Test Result">
        {showResult && (
          <form onSubmit={handleResult} className="space-y-4">
            <div className="bg-slate-800 rounded-lg px-4 py-3">
              <p className="text-sm font-medium text-slate-200">{showResult.test.test_name}</p>
              <p className="text-xs text-slate-500">{showResult.test.category} · {showResult.test.specimen_required}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Numeric Value</label>
                <input className="input" type="number" step="0.01" placeholder="e.g. 12.5"
                  value={resultForm.numeric_value} onChange={e => setRF('numeric_value', e.target.value)} />
              </div>
              <div>
                <label className="label">Unit</label>
                <input className="input" placeholder="e.g. g/dL, mmol/L"
                  value={resultForm.unit} onChange={e => setRF('unit', e.target.value)} />
              </div>
              <div>
                <label className="label">Reference Low</label>
                <input className="input" placeholder="e.g. 11.5"
                  value={resultForm.reference_range_low} onChange={e => setRF('reference_range_low', e.target.value)} />
              </div>
              <div>
                <label className="label">Reference High</label>
                <input className="input" placeholder="e.g. 16.5"
                  value={resultForm.reference_range_high} onChange={e => setRF('reference_range_high', e.target.value)} />
              </div>
              <div>
                <label className="label">Abnormal Flag</label>
                <select className="select" value={resultForm.abnormal_flag} onChange={e => setRF('abnormal_flag', e.target.value)}>
                  <option value="">— Normal —</option>
                  {['N','L','H','LL','HH','A','POS','NEG'].map(f => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Text Result</label>
                <input className="input" placeholder="e.g. No growth, Positive"
                  value={resultForm.text_value} onChange={e => setRF('text_value', e.target.value)} />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-red-400 cursor-pointer">
              <input type="checkbox" checked={resultForm.is_critical}
                onChange={e => setRF('is_critical', e.target.checked)} className="accent-red-500" />
              <AlertTriangle className="w-3.5 h-3.5" /> Mark as Critical Value
            </label>
            <div className="flex gap-3">
              <button type="submit" className="btn-primary flex items-center gap-2" disabled={saving}>
                {saving ? <Spinner className="w-4 h-4" /> : <FlaskConical className="w-4 h-4" />}
                Submit Result
              </button>
              <button type="button" className="btn-secondary" onClick={() => setShowResult(null)}>Cancel</button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
