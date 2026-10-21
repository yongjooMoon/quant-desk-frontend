// src/auth.jsx - login state for the private pages (calendar, infinite buying, admin). Token comes from POST /api/auth/login (backend auth_api.py), lives 12 h and is sent as `Authorization: Bearer`.
// The token and the user are kept in localStorage so a reload stays logged in; the token is re-checked against /api/auth/me once per load (401 clears it, a network error keeps it).
import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { BASE_URL } from './hooks/useRenderApi';

const TOKEN_KEY = 'qd_token';
const USER_KEY = 'qd_user';
const read = (k) => { try { return localStorage.getItem(k) || ''; } catch { return ''; } };
const write = (k, v) => { try { if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); } catch { /* storage unavailable: login lasts until reload */ } };

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => read(TOKEN_KEY));
  const [user, setUser] = useState(() => { try { return JSON.parse(read(USER_KEY) || 'null'); } catch { return null; } });

  const logout = useCallback(() => { write(TOKEN_KEY, ''); write(USER_KEY, ''); setToken(''); setUser(null); }, []);
  const login = useCallback((tok, u) => { write(TOKEN_KEY, tok); write(USER_KEY, JSON.stringify(u)); setToken(tok); setUser(u); }, []);

  useEffect(() => {
    if (!token) return;
    fetch(`${BASE_URL}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => { if (r.status === 401) logout(); else if (r.ok) return r.json().then((j) => { write(USER_KEY, JSON.stringify(j.user)); setUser(j.user); }); })
      .catch(() => { /* server asleep or offline: keep the cached login */ });
  }, [token, logout]);

  const value = useMemo(() => ({ token, user, login, logout, headers: token ? { Authorization: `Bearer ${token}` } : {} }), [token, user, login, logout]);
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
