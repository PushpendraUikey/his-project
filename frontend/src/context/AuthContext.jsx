import { createContext, useContext, useState, useCallback, useEffect } from 'react';

const AuthContext = createContext(null);

const STORAGE_KEY = 'his_auth';

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(() => {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch { return null; }
  });

  const login = useCallback((token, user) => {
    const data = { token, user };
    setAuth(data);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, []);

  const logout = useCallback(() => {
    setAuth(null);
    sessionStorage.removeItem(STORAGE_KEY);
  }, []);

  // Auto-expire check on tab focus
  useEffect(() => {
    const check = () => {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (!stored) setAuth(null);
    };
    window.addEventListener('focus', check);
    return () => window.removeEventListener('focus', check);
  }, []);

  return (
    <AuthContext.Provider value={{ auth, login, logout, user: auth?.user, token: auth?.token }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

// ── Role-based access: which routes each role can see ──────
// Strict RBAC — no cross-role UI access
export const ROLE_ACCESS = {
  admin:             ['admin', 'hie'],
  doctor:            ['doctor'],
  nurse:             ['nurse'],
  lab_technician:    ['lab'],
  verifier:          ['verifier'],
  registration_desk: ['registration'],
  admission_desk:    ['admission'],
  // Legacy support
  receptionist:      ['registration', 'admission'],
};

export function canAccess(role, module) {
  const allowed = ROLE_ACCESS[role] || [];
  return allowed.includes(module);
}
