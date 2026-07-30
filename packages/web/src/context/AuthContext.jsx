import { createContext, useContext, useEffect, useState } from 'react';
import { api, setAccessToken } from '../api.js';

/**
 * Auth in Context, not Zustand — deliberately, per the roadmap.
 *
 * The signed-in user changes twice a session and is read by almost every
 * component. That is exactly what Context is good at. Log entries change
 * constantly and are read by a few components, which is why they live in a
 * Zustand store instead.
 */
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | signedIn | signedOut

  // On mount, try the refresh cookie. This is what makes a page reload keep you
  // signed in even though the access token only ever existed in memory.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const session = await api.refresh().catch(() => null);
      if (cancelled) return;

      if (session?.user) {
        setUser(session.user);
        setStatus('signedIn');
      } else {
        setStatus('signedOut');
      }
    })();

    return () => { cancelled = true; };
  }, []);

  const adopt = (session) => {
    setAccessToken(session.accessToken);
    setUser(session.user);
    setStatus('signedIn');
  };

  const value = {
    user,
    status,
    isSignedIn: status === 'signedIn',
    register: async (payload) => adopt(await api.register(payload)),
    login: async (payload) => adopt(await api.login(payload)),
    logout: async () => {
      await api.logout().catch(() => {});
      setAccessToken(null);
      setUser(null);
      setStatus('signedOut');
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
