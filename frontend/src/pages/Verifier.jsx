import { useState, useEffect, useCallback } from 'react';
import { ShieldCheck, CheckCircle2, XCircle, AlertCircle, FileSpreadsheet } from 'lucide-react';
import { api, formatDateTime, age } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { PageHeader, Spinner, ErrorBanner, EmptyState, PriorityBadge } from '../components/ui';

export default function Verifier() {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [verifiers, setVerifiers] = useState([]);
  const [verifierId, setVerifierId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [ord, ver] = await Promise.all([api.getVerifierOrders(), api.getVerifiers()]);
      setOrders(ord); setVerifiers(ver);
      if (ver.length && !verifierId) setVerifierId(ver[0].provider_id);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [verifierId]);

  useEffect(() => { load(); }, [load]);

  async function handleApprove(order) {
    if (!confirm('Are you sure you want to completely verify and release these results?')) return;
    setSaving(true); setError('');
    try {
      await api.approveVerifierOrder(order.lab_order_id, { verifier_id: verifierId });
      setSelected(null);
      load();
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  }

  async function handleReject(order) {
    if (!confirm('Are you sure you want to reject? This will delete simulated results and require re-processing.')) return;
    setSaving(true); setError('');
    try {
      await api.rejectVerifierOrder(order.lab_order_id, { verifier_id: verifierId });
      setSelected(null);
      load();
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  }

  const flagColor = { H:'text-red-400', HH:'text-red-500', L:'text-blue-400', LL:'text-blue-500', A:'text-amber-400', POS:'text-red-400', NEG:'text-emerald-400', N:'text-emerald-400' };

  return (
    <div className="flex h-screen overflow-hidden">
      <div className="w-96 border-r border-slate-800 flex flex-col bg-slate-950 overflow-hidden">
        <div className="px-4 py-4 border-b border-slate-800">
          <h2 className="font-semibold text-slate-200 mb-1">Result Verifier</h2>
          <div className="mt-3">
            <label className="label">Verifier</label>
            <select className="select text-xs" value={verifierId} onChange={e => setVerifierId(e.target.value)}>
              {verifiers.map(t => <option key={t.provider_id} value={t.provider_id}>{t.full_name}</option>)}
            </select>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : orders.length === 0 ? (
            <EmptyState icon={ShieldCheck} message="No orders to verify" />
          ) : (
            orders.map(o => (
              <button key={o.lab_order_id} onClick={() => setSelected(o)}
                className={`w-full text-left px-4 py-3.5 border-b border-slate-800 hover:bg-slate-900 transition-colors ${selected?.lab_order_id === o.lab_order_id ? 'bg-slate-900 border-l-2 border-l-rose-500' : ''}`}>
                <div className="flex items-start justify-between mb-1">
                  <p className="text-sm font-medium text-slate-200 truncate">{o.patient_name}</p>
                  <PriorityBadge priority={o.priority} />
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <p className="font-mono text-xs text-rose-400">{o.order_number}</p>
                  <span className={`badge ${o.order_status === 'verified' ? 'badge-green' : 'badge-yellow'} text-xs capitalize`}>{o.order_status}</span>
                </div>
                <p className="text-xs text-slate-500 mt-1">{o.ward_name} · Bed {o.bed_number}</p>
              </button>
            ))
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {!selected ? (
          <>
            <PageHeader title="Lab Result Verification" subtitle="Review and approve clinical lab results" />
            <div className="flex flex-col items-center justify-center py-16 text-slate-600">
              <FileSpreadsheet className="w-12 h-12 mb-4 opacity-30" />
              <p className="text-sm">Select an order from the queue to verify results</p>
            </div>
          </>
        ) : (
          <>
            <ErrorBanner message={error} />
            <div className="card mb-5">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-100">{selected.patient_name}</h2>
                  <p className="text-sm text-slate-500">{selected.mrn} · {selected.ward_name} · Bed {selected.bed_number}</p>
                  <p className="font-mono text-xs text-amber-400 mt-2">Order: {selected.order_number}</p>
                </div>
                <div className="flex gap-2">
                  {selected.order_status !== 'verified' && (
                    <>
                      <button className="btn-secondary flex items-center gap-1.5 text-sm hover:!bg-red-500/20 hover:!text-red-400 hover:!border-red-500/50" disabled={saving} onClick={() => handleReject(selected)}>
                        <XCircle className="w-4 h-4" /> Reject & Re-Process
                      </button>
                      <button className="btn-primary flex items-center gap-1.5 text-sm bg-emerald-600 hover:bg-emerald-500 text-white border-none" disabled={saving} onClick={() => handleApprove(selected)}>
                        <ShieldCheck className="w-4 h-4" /> Verify Results
                      </button>
                    </>
                  )}
                  {selected.order_status === 'verified' && (
                    <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-lg text-sm font-medium">
                      <CheckCircle2 className="w-4 h-4" /> Verified
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-800/50 text-slate-400 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3 font-medium">Test Name</th>
                    <th className="px-4 py-3 font-medium">Simulated Result</th>
                    <th className="px-4 py-3 font-medium">Flag</th>
                    <th className="px-4 py-3 font-medium">Ref Range</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {selected.tests?.map((t, i) => (
                     <tr key={i} className="hover:bg-slate-800/30 transition-colors">
                       <td className="px-4 py-3">
                         <p className="text-slate-200 font-medium">{t.test_name}</p>
                         <p className="text-slate-500 text-xs font-mono">{t.test_code}</p>
                       </td>
                       <td className="px-4 py-3">
                         {t.result_numeric ? (
                           <span className="font-mono text-slate-300">{t.result_numeric} {t.unit}</span>
                         ) : t.result_text ? (
                           <span className="text-slate-300">{t.result_text}</span>
                         ) : (
                           <span className="text-slate-600">—</span>
                         )}
                       </td>
                       <td className="px-4 py-3">
                         {t.flag && (
                           <span className={`font-bold ${flagColor[t.flag] || 'text-slate-400'}`}>{t.flag}</span>
                         )}
                       </td>
                       <td className="px-4 py-3 text-slate-500 text-xs">
                         {t.ref_low && t.ref_high ? `${t.ref_low} - ${t.ref_high} ${t.unit}` : '—'}
                       </td>
                     </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
