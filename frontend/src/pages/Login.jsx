import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, Lock, User, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const ROLE_COLORS = {
  doctor:         'text-emerald-400 bg-emerald-500/10',
  nurse:          'text-pink-400 bg-pink-500/10',
  lab_technician: 'text-amber-400 bg-amber-500/10',
  admin:          'text-violet-400 bg-violet-500/10',
  receptionist:   'text-cyan-400 bg-cyan-500/10',
};

const DEMO_ACCOUNTS = [
  { code: 'DOC-001', role: 'Doctor',          label: 'Dr. Arjun Mehta',        color: 'text-emerald-400' },
  { code: 'DOC-002', role: 'Doctor',          label: 'Dr. Priya Krishnaswamy', color: 'text-emerald-400' },
  { code: 'NRS-001', role: 'Nurse',           label: 'Nurse Kavitha Ramesh',   color: 'text-pink-400'   },
  { code: 'LAB-001', role: 'Lab Technician',  label: 'Ravi Shankar Kumar',     color: 'text-amber-400'  },
  { code: 'ADM-001', role: 'Admin',           label: 'Prakash Iyer',           color: 'text-violet-400' },
];

export default function Login() {
  const { login } = useAuth();
  const navigate  = useNavigate();

  const [providerCode, setProviderCode] = useState('');
  const [password, setPassword]         = useState('');
  const [showPw, setShowPw]             = useState(false);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!providerCode.trim() || !password.trim()) {
      return setError('Provider ID and password are required.');
    }
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providerCode: providerCode.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');
      login(data.token, data.user);

      // Route based on role
      const roleRoutes = {
        doctor:         '/doctor',
        nurse:          '/nurse',
        lab_technician: '/lab',
        admin:          '/registration',
        receptionist:   '/registration',
      };
      navigate(roleRoutes[data.user.role] || '/registration', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function fillDemo(code) {
    setProviderCode(code);
    setPassword('password123');
    setError('');
  }

  return (
    <div className="min-h-screen bg-slate-950 flex">
      {/* Left panel — branding */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 bg-gradient-to-br from-slate-900 to-slate-950 border-r border-slate-800 p-12">
        <div className="flex items-center gap-3">
          <Activity className="text-cyan-400 w-7 h-7" />
          <span className="text-xl font-semibold text-slate-100 tracking-tight">
            MediCore <span className="text-cyan-400">HIS</span>
          </span>
        </div>

        <div>
          <h1 className="text-4xl font-bold text-slate-100 leading-tight mb-4">
            Hospital Information<br />
            <span className="text-cyan-400">Exchange System</span>
          </h1>
          <p className="text-slate-400 text-lg leading-relaxed mb-8">
            Integrated ADT · LIS · FHIR R4 messaging<br />
            HL7 v2 ↔ FHIR health data exchange
          </p>

          <div className="space-y-3">
            {[
              { icon: '🏥', label: 'ADT Module', desc: 'Admissions, Discharges & Transfers' },
              { icon: '🧪', label: 'LIS Module', desc: 'Lab orders, specimens & results' },
              { icon: '🔄', label: 'HIE / FHIR R4', desc: 'Real-time HL7 health data exchange' },
              { icon: '🔐', label: 'Role-based Access', desc: 'Doctor · Nurse · Lab Tech · Admin' },
            ].map(({ icon, label, desc }) => (
              <div key={label} className="flex items-center gap-3 text-sm">
                <span className="text-xl">{icon}</span>
                <div>
                  <span className="text-slate-300 font-medium">{label}</span>
                  <span className="text-slate-500 ml-2">{desc}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-slate-700">
          FHIR R4 · HL7 v2 · HL7 v3 · SNOMED CT · LOINC
        </p>
      </div>

      {/* Right panel — login form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <Activity className="text-cyan-400 w-5 h-5" />
            <span className="font-semibold text-slate-100">MediCore <span className="text-cyan-400">HIS</span></span>
          </div>

          <h2 className="text-2xl font-bold text-slate-100 mb-1">Sign in</h2>
          <p className="text-slate-500 text-sm mb-8">Use your provider code and password to access the system.</p>

          {error && (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg px-4 py-3 mb-5 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm text-slate-400 mb-1.5 font-medium">Provider ID</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-4 pl-10 py-2.5 text-sm
                             placeholder-slate-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30 transition-all"
                  placeholder="e.g. DOC-001"
                  value={providerCode}
                  onChange={e => setProviderCode(e.target.value)}
                  autoComplete="username"
                  autoFocus
                />
              </div>
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-1.5 font-medium">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type={showPw ? 'text' : 'password'}
                  className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-4 pl-10 pr-10 py-2.5 text-sm
                             placeholder-slate-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30 transition-all"
                  placeholder="Enter password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
                <button type="button" onClick={() => setShowPw(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed
                         text-slate-950 font-semibold rounded-lg py-2.5 text-sm transition-all flex items-center justify-center gap-2">
              {loading ? (
                <span className="w-4 h-4 border-2 border-slate-950/30 border-t-slate-950 rounded-full animate-spin" />
              ) : (
                <Lock className="w-4 h-4" />
              )}
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          {/* Demo accounts */}
          <div className="mt-8">
            <p className="text-xs text-slate-600 uppercase tracking-wider mb-3">Demo accounts (password: password123)</p>
            <div className="space-y-2">
              {DEMO_ACCOUNTS.map(acc => (
                <button
                  key={acc.code}
                  onClick={() => fillDemo(acc.code)}
                  className="w-full flex items-center justify-between bg-slate-800/60 hover:bg-slate-800 border border-slate-700/50
                             rounded-lg px-4 py-2.5 text-sm transition-all group">
                  <div className="flex items-center gap-3">
                    <span className={`font-mono text-xs px-2 py-0.5 rounded ${ROLE_COLORS[acc.code.startsWith('DOC') ? 'doctor' : acc.code.startsWith('NRS') ? 'nurse' : acc.code.startsWith('LAB') ? 'lab_technician' : 'admin'] || 'text-slate-400'}`}>
                      {acc.code}
                    </span>
                    <span className="text-slate-400">{acc.label}</span>
                  </div>
                  <span className={`text-xs ${acc.color} opacity-70 group-hover:opacity-100 transition-opacity`}>{acc.role}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
