import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  UserPlus, BedDouble, Stethoscope, FlaskConical, HeartPulse, Activity, Network, LogOut, ChevronDown
} from 'lucide-react';
import { useAuth, canAccess } from '../context/AuthContext';
import { ROLE_LABELS, ROLE_COLORS } from '../lib/api';
import { useState } from 'react';

const ALL_MODULES = [
  { path: '/registration', label: 'Registration',    icon: UserPlus,     color: 'text-violet-400', module: 'registration' },
  { path: '/admission',    label: 'Admission / ADT', icon: BedDouble,    color: 'text-cyan-400',   module: 'admission'    },
  { path: '/nurse',        label: "Nurse's Station",  icon: HeartPulse,  color: 'text-pink-400',   module: 'nurse'        },
  { path: '/doctor',       label: "Doctor's View",   icon: Stethoscope,  color: 'text-emerald-400',module: 'doctor'       },
  { path: '/lab',          label: 'Laboratory (LIS)', icon: FlaskConical, color: 'text-amber-400', module: 'lab'          },
  { path: '/hie',          label: 'HIE / FHIR R4',   icon: Network,      color: 'text-sky-400',   module: 'hie'          },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showUser, setShowUser] = useState(false);

  const modules = ALL_MODULES.filter(m =>
    !user || canAccess(user.role, m.module)
  );

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  const roleColorClass = user ? (ROLE_COLORS[user.role]?.split(' ')[0] || 'text-slate-400') : 'text-slate-400';

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-60 bg-slate-950 border-r border-slate-800 flex flex-col shrink-0">
        {/* Brand */}
        <div className="px-6 py-5 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Activity className="text-cyan-400 w-5 h-5" />
            <span className="font-semibold text-slate-100 tracking-tight">
              MediCore <span className="text-cyan-400">HIS</span>
            </span>
          </div>
          <p className="text-xs text-slate-600 mt-0.5">Hospital Information System</p>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {modules.map(({ path, label, icon: Icon, color, module: mod }) => (
            <NavLink
              key={path}
              to={path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-slate-800 text-slate-100'
                    : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/60'
                }`
              }
            >
              <Icon className={`w-4 h-4 shrink-0 ${color}`} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* User panel */}
        {user && (
          <div className="border-t border-slate-800 px-3 py-3">
            <button
              onClick={() => setShowUser(s => !s)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-800 transition-all group">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold
                ${ROLE_COLORS[user.role] || 'text-slate-400 bg-slate-800'}`}>
                {user.full_name?.charAt(0).toUpperCase() || '?'}
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-xs font-medium text-slate-300 truncate">{user.full_name}</p>
                <p className={`text-xs truncate ${roleColorClass}`}>{ROLE_LABELS[user.role] || user.role}</p>
              </div>
              <ChevronDown className={`w-3.5 h-3.5 text-slate-600 transition-transform ${showUser ? 'rotate-180' : ''}`} />
            </button>

            {showUser && (
              <div className="mt-1 space-y-1 px-1">
                <div className="px-3 py-2 rounded-lg bg-slate-800/50 text-xs text-slate-500">
                  <p className="font-mono">{user.provider_code}</p>
                  <p className="mt-0.5 text-slate-600">{user.role}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-red-400
                             hover:bg-red-500/10 transition-all">
                  <LogOut className="w-4 h-4" />
                  Sign out
                </button>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800">
          <p className="text-xs text-slate-700">v2.0.0 · FHIR R4 · HL7 v3</p>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto bg-slate-900">
        <Outlet />
      </main>
    </div>
  );
}
