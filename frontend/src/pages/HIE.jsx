import { useState, useEffect, useCallback } from 'react';
import { Network, RefreshCw, Eye, ChevronDown, ChevronRight, AlertCircle, CheckCircle, ArrowUpRight, ArrowDownLeft, Search, Filter } from 'lucide-react';
import { api, formatDateTime } from '../lib/api';
import { PageHeader, Spinner, ErrorBanner, StatCard, EmptyState } from '../components/ui';

const MSG_COLORS = {
  ADT_A01: { bg: 'bg-cyan-500/15 border-cyan-500/30',   text: 'text-cyan-400',   label: 'ADT A01 · Admit'    },
  ADT_A02: { bg: 'bg-amber-500/15 border-amber-500/30', text: 'text-amber-400',  label: 'ADT A02 · Transfer' },
  ADT_A03: { bg: 'bg-red-500/15 border-red-500/30',     text: 'text-red-400',    label: 'ADT A03 · Discharge'},
  ORU_R01: { bg: 'bg-violet-500/15 border-violet-500/30', text: 'text-violet-400', label: 'ORU R01 · Lab'     },
  INBOUND: { bg: 'bg-slate-700/40 border-slate-600/40', text: 'text-slate-400',  label: 'Inbound'            },
};

const EVENT_ICONS = {
  ADMIT:      '🏥',
  TRANSFER:   '🔄',
  DISCHARGE:  '🚪',
  LAB_RESULT: '🧪',
  RECEIVED:   '📥',
};

function JSONViewer({ data, depth = 0 }) {
  const [collapsed, setCollapsed] = useState(depth > 1);

  if (data === null || data === undefined) return <span className="text-slate-500">null</span>;
  if (typeof data === 'boolean') return <span className="text-amber-400">{String(data)}</span>;
  if (typeof data === 'number') return <span className="text-cyan-400">{data}</span>;
  if (typeof data === 'string') return <span className="text-emerald-400">"{data}"</span>;

  if (Array.isArray(data)) {
    if (data.length === 0) return <span className="text-slate-500">[]</span>;
    return (
      <span>
        <button onClick={() => setCollapsed(c => !c)} className="text-amber-400 hover:text-amber-300 transition-colors">
          {collapsed ? <ChevronRight className="w-3 h-3 inline" /> : <ChevronDown className="w-3 h-3 inline" />}
          <span className="text-slate-500 text-xs ml-1">[{data.length}]</span>
        </button>
        {!collapsed && (
          <div className="ml-4 border-l border-slate-700 pl-3">
            {data.map((item, i) => (
              <div key={i} className="my-0.5">
                <span className="text-slate-600 text-xs">{i}: </span>
                <JSONViewer data={item} depth={depth + 1} />
              </div>
            ))}
          </div>
        )}
      </span>
    );
  }

  if (typeof data === 'object') {
    const keys = Object.keys(data);
    if (keys.length === 0) return <span className="text-slate-500">{'{}'}</span>;
    return (
      <span>
        <button onClick={() => setCollapsed(c => !c)} className="text-amber-400 hover:text-amber-300 transition-colors">
          {collapsed ? <ChevronRight className="w-3 h-3 inline" /> : <ChevronDown className="w-3 h-3 inline" />}
          {collapsed && <span className="text-slate-500 text-xs ml-1">{'{'}…{'}'}</span>}
        </button>
        {!collapsed && (
          <div className="ml-4 border-l border-slate-700 pl-3">
            {keys.map(k => (
              <div key={k} className="my-0.5 flex items-start gap-1">
                <span className="text-violet-300 text-xs shrink-0">"{k}"</span>
                <span className="text-slate-500 text-xs">: </span>
                <JSONViewer data={data[k]} depth={depth + 1} />
              </div>
            ))}
          </div>
        )}
      </span>
    );
  }

  return <span className="text-slate-400">{String(data)}</span>;
}

export default function HIE() {
  const [messages, setMessages]   = useState([]);
  const [stats, setStats]         = useState(null);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const [selected, setSelected]   = useState(null);
  const [typeFilter, setTypeFilter] = useState('');
  const [searchQ, setSearchQ]     = useState('');
  const [total, setTotal]         = useState(0);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const params = {};
      if (typeFilter) params.type = typeFilter;
      const [msgs, st] = await Promise.all([
        api.getHIEMessages({ ...params, limit: 50 }),
        api.getHIEStats(),
      ]);
      setMessages(msgs.messages || []);
      setTotal(msgs.total || 0);
      setStats(st);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [typeFilter]);

  useEffect(() => { load(); }, [load]);

  const filtered = searchQ
    ? messages.filter(m =>
        m.patient_name?.toLowerCase().includes(searchQ.toLowerCase()) ||
        m.mrn?.includes(searchQ) ||
        m.message_type?.includes(searchQ.toUpperCase()) ||
        m.event_type?.includes(searchQ.toUpperCase()) ||
        m.message_id?.includes(searchQ)
      )
    : messages;

  const msgColor = (m) => MSG_COLORS[m.message_type] || MSG_COLORS.INBOUND;

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Message list */}
      <div className="w-96 border-r border-slate-800 flex flex-col bg-slate-950 overflow-hidden">
        <div className="px-4 py-4 border-b border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-slate-200 flex items-center gap-2">
                <Network className="w-4 h-4 text-cyan-400" />
                HIE Message Log
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">{total} total messages</p>
            </div>
            <button onClick={load}
              className="p-2 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-all">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {/* Stats strip */}
          {stats && (
            <div className="grid grid-cols-4 gap-1.5">
              {[
                { label: 'Admit', val: stats.adt_admit   || 0, color: 'text-cyan-400',   type: 'ADT_A01' },
                { label: 'Xfer',  val: stats.adt_transfer|| 0, color: 'text-amber-400',  type: 'ADT_A02' },
                { label: 'D/C',   val: stats.adt_discharge||0, color: 'text-red-400',    type: 'ADT_A03' },
                { label: 'Lab',   val: stats.oru_lab     || 0, color: 'text-violet-400', type: 'ORU_R01' },
              ].map(s => (
                <button key={s.type}
                  onClick={() => setTypeFilter(typeFilter === s.type ? '' : s.type)}
                  className={`rounded-lg px-2 py-1.5 text-center transition-all border ${
                    typeFilter === s.type
                      ? 'bg-slate-700 border-slate-600'
                      : 'bg-slate-800/60 border-transparent hover:bg-slate-800'
                  }`}>
                  <div className={`text-sm font-bold ${s.color}`}>{s.val}</div>
                  <div className="text-xs text-slate-500">{s.label}</div>
                </button>
              ))}
            </div>
          )}

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
            <input
              className="w-full bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded-lg pl-8 pr-3 py-2
                         placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition-all"
              placeholder="Search patient, MRN, message ID…"
              value={searchQ}
              onChange={e => setSearchQ(e.target.value)}
            />
          </div>

          {typeFilter && (
            <button onClick={() => setTypeFilter('')}
              className="flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300">
              <Filter className="w-3 h-3" />
              {MSG_COLORS[typeFilter]?.label}
              <span className="text-slate-500">× clear</span>
            </button>
          )}
        </div>

        {/* Message list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : filtered.length === 0 ? (
            <EmptyState icon={Network} message="No HIE messages yet" />
          ) : (
            filtered.map(m => {
              const col = msgColor(m);
              const isSelected = selected?.log_id === m.log_id;
              return (
                <button
                  key={m.log_id}
                  onClick={() => setSelected(m)}
                  className={`w-full text-left px-4 py-3.5 border-b border-slate-800/60 transition-colors ${
                    isSelected ? 'bg-slate-800/80 border-l-2 border-l-cyan-500' : 'hover:bg-slate-900/60'
                  }`}>
                  <div className="flex items-start justify-between mb-1.5">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded border ${col.bg} ${col.text}`}>
                      {EVENT_ICONS[m.event_type]} {col.label}
                    </span>
                    <span className={`text-xs flex items-center gap-1 ${
                      m.direction === 'outbound' ? 'text-slate-500' : 'text-violet-400'
                    }`}>
                      {m.direction === 'outbound'
                        ? <ArrowUpRight className="w-3 h-3" />
                        : <ArrowDownLeft className="w-3 h-3" />}
                      {m.direction}
                    </span>
                  </div>
                  <div className="text-sm font-medium text-slate-300 truncate">
                    {m.patient_name || 'Unknown Patient'}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    {m.mrn && <span className="text-xs font-mono text-slate-500">{m.mrn}</span>}
                    {m.admission_number && (
                      <span className="text-xs text-slate-600">{m.admission_number}</span>
                    )}
                  </div>
                  <div className="flex items-center justify-between mt-1.5">
                    <span className="text-xs text-slate-600 font-mono truncate max-w-[160px]">
                      {m.message_id?.slice(0, 18)}…
                    </span>
                    <span className="text-xs text-slate-600">{formatDateTime(m.sent_at)}</span>
                  </div>
                  {m.destination && m.destination !== 'internal' && (
                    <div className="mt-1 text-xs text-amber-400 truncate">→ {m.destination}</div>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Detail panel */}
      <div className="flex-1 overflow-y-auto bg-slate-950 p-6">
        <ErrorBanner message={error} />

        {!selected ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-600">
            <Network className="w-12 h-12 mb-4 opacity-20" />
            <p className="text-sm font-medium text-slate-500">Select a message to inspect the FHIR Bundle</p>
            <p className="text-xs text-slate-600 mt-1">HL7 FHIR R4 · ADT · ORU messages</p>
          </div>
        ) : (
          <div className="max-w-4xl">
            {/* Message header card */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <span className={`text-sm font-bold px-2.5 py-1 rounded-lg border ${msgColor(selected).bg} ${msgColor(selected).text}`}>
                      {EVENT_ICONS[selected.event_type]} {selected.message_type} · {selected.event_type}
                    </span>
                    <span className={`text-xs flex items-center gap-1.5 px-2 py-1 rounded-full ${
                      selected.status === 'sent' ? 'bg-emerald-500/10 text-emerald-400'
                      : selected.status === 'error' ? 'bg-red-500/10 text-red-400'
                      : 'bg-slate-700 text-slate-400'
                    }`}>
                      {selected.status === 'sent' ? <CheckCircle className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                      {selected.status}
                    </span>
                  </div>
                  <p className="text-lg font-semibold text-slate-100">
                    {selected.patient_name || 'Unknown Patient'}
                  </p>
                  {selected.mrn && (
                    <p className="text-sm text-slate-500 font-mono">{selected.mrn}</p>
                  )}
                </div>
                <div className="text-right text-xs text-slate-500">
                  <p>{formatDateTime(selected.sent_at)}</p>
                  {selected.triggered_by_name && (
                    <p className="mt-1">By: {selected.triggered_by_name}</p>
                  )}
                  {selected.destination && selected.destination !== 'internal' && (
                    <p className="mt-1 text-amber-400">→ {selected.destination}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 pt-3 border-t border-slate-800">
                <div>
                  <p className="text-xs text-slate-600 mb-0.5">Message ID</p>
                  <p className="text-xs font-mono text-slate-400 truncate">{selected.message_id}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-600 mb-0.5">Direction</p>
                  <p className="text-xs text-slate-400 capitalize">{selected.direction}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-600 mb-0.5">Source</p>
                  <p className="text-xs text-slate-400">{selected.source_system || 'MediCore HIS'}</p>
                </div>
              </div>
            </div>

            {/* FHIR Bundle Resources Summary */}
            {selected.fhir_bundle && (() => {
              const bundle = selected.fhir_bundle;
              const entries = bundle.entry || [];
              const resources = entries.map(e => e.resource).filter(Boolean);
              const resourceTypes = [...new Set(resources.map(r => r.resourceType))];
              return (
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-5">
                  <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                    <span className="w-5 h-5 rounded bg-cyan-500/20 flex items-center justify-center text-cyan-400 text-xs font-bold">R4</span>
                    FHIR R4 Bundle Resources ({entries.length})
                  </h3>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {resourceTypes.map(rt => {
                      const count = resources.filter(r => r.resourceType === rt).length;
                      const colors = {
                        MessageHeader: 'bg-slate-700 text-slate-300',
                        Patient: 'bg-cyan-500/15 text-cyan-400',
                        Encounter: 'bg-emerald-500/15 text-emerald-400',
                        Practitioner: 'bg-blue-500/15 text-blue-400',
                        Location: 'bg-amber-500/15 text-amber-400',
                        DiagnosticReport: 'bg-violet-500/15 text-violet-400',
                        ServiceRequest: 'bg-pink-500/15 text-pink-400',
                        Observation: 'bg-orange-500/15 text-orange-400',
                      };
                      return (
                        <span key={rt}
                          className={`text-xs px-2.5 py-1 rounded-full font-medium ${colors[rt] || 'bg-slate-700 text-slate-400'}`}>
                          {rt} {count > 1 ? `×${count}` : ''}
                        </span>
                      );
                    })}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: 'Bundle ID', val: bundle.id?.slice(0, 16) + '…' },
                      { label: 'Type',      val: bundle.type },
                      { label: 'Timestamp', val: formatDateTime(bundle.timestamp) },
                    ].map(({ label, val }) => (
                      <div key={label} className="bg-slate-800/50 rounded-lg px-3 py-2">
                        <p className="text-xs text-slate-600">{label}</p>
                        <p className="text-xs text-slate-400 font-mono truncate">{val}</p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Raw FHIR JSON */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800">
                <h3 className="text-sm font-semibold text-slate-300">Raw FHIR R4 Bundle (JSON)</h3>
                <button
                  onClick={() => navigator.clipboard?.writeText(JSON.stringify(selected.fhir_bundle, null, 2))}
                  className="text-xs text-slate-500 hover:text-cyan-400 transition-colors px-3 py-1 rounded-md hover:bg-slate-800">
                  Copy JSON
                </button>
              </div>
              <div className="p-5 text-xs font-mono overflow-x-auto max-h-[50vh] overflow-y-auto">
                <JSONViewer data={selected.fhir_bundle} depth={0} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
