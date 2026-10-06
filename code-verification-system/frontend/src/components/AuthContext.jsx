import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import * as api from '../services/api.js';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getMe()
      .then((res) => setAdmin(res.data.admin))
      .catch(() => setAdmin(null))
      .finally(() => setLoading(false));
  }, []);

  const signIn = useCallback(async (email, password) => {
    const res = await api.login(email, password);
    setAdmin(res.data.admin);
  }, []);

  const signOut = useCallback(async () => {
    try { await api.logout(); } finally { setAdmin(null); }
  }, []);

  return <AuthContext.Provider value={{ admin, loading, signIn, signOut }}>{children}</AuthContext.Provider>;
}
