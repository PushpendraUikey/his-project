import { NavLink, Outlet } from 'react-router-dom';
import {
  UserPlus, BedDouble, Stethoscope, FlaskConical, HeartPulse, Activity
} from 'lucide-react';

const modules = [
  { path: '/registration', label: 'Registration',  icon: UserPlus,     color: 'text-violet-400' },
  { path: '/admission',    label: 'Admission',      icon: BedDouble,    color: 'text-cyan-400'   },
  { path: '/nurse',        label: "Nurse's Station", icon: HeartPulse,  color: 'text-pink-400'   },
  { path: '/doctor',       label: "Doctor's View",  icon: Stethoscope,  color: 'text-emerald-400'},
  { path: '/lab',          label: 'Laboratory',     icon: FlaskConical, color: 'text-amber-400'  },
];

export default function Layout() {
  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-60 bg-slate-950 border-r border-slate-800 flex flex-col shrink-0">
        {/* Brand */}
        <div className="px-6 py-5 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Activity className="text-cyan-400 w-5 h-5" />
            <span className="font-semibold text-slate-100 tracking-tight">MediCore <span className="text-cyan-400">HIS</span></span>
          </div>
          <p className="text-xs text-slate-600 mt-0.5">Hospital Information System</p>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {modules.map(({ path, label, icon: Icon, color }) => (
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

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800">
          <p className="text-xs text-slate-600">v1.0.0 · Demo Mode</p>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
