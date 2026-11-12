import React, { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { ApiError, registerApiHandlers, setToken } from '../api/client';
import { api } from '../api/endpoints';
import type { AccessLevel, AdminUser, ModuleKey, Permissions } from '../api/types';
import { clearToken, loadToken, saveToken } from '../utils/tokenStorage';
import { useToast } from './toast';

type Status = 'loading' | 'signedOut' | 'signedIn';

type AuthContextValue = {
  status: Status;
  user: AdminUser | null;
  permissions: Permissions | null;
  expiresAt: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  can: (module: ModuleKey, level?: Exclude<AccessLevel, 'none'>) => boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

const EXPIRY_WARNING_MS = 5 * 60_000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const toast = useToast();
  const [status, setStatus] = useState<Status>('loading');
  const [user, setUser] = useState<AdminUser | null>(null);
  const [permissions, setPermissions] = useState<Permissions | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  const endSession = useCallback(
    async (message?: string) => {
      clearTimers();
      setToken(null);
      await clearToken();
      setUser(null);
      setPermissions(null);
      setExpiresAt(null);
      setStatus('signedOut');
      if (message) toast.show(message);
    },
    [toast],
  );

  // Absolute 2-hour session: warn shortly before, then sign out locally when the server would reject anyway.
  useEffect(() => {
    clearTimers();
    if (!expiresAt) return;
    const remaining = new Date(expiresAt).getTime() - Date.now();
    if (remaining <= 0) {
      void endSession('Your session has expired. Please sign in again.');
      return;
    }
    if (remaining > EXPIRY_WARNING_MS) {
      timers.current.push(setTimeout(() => toast.show('Your session expires in 5 minutes. Save any changes.'), remaining - EXPIRY_WARNING_MS));
    }
    // setTimeout overflows above ~24.8 days; sessions are hours long, so this is safe.
    timers.current.push(setTimeout(() => void endSession('Your session has expired. Please sign in again.'), remaining));
    return clearTimers;
  }, [expiresAt, endSession, toast]);

  const refresh = useCallback(async () => {
    try {
      const me = await api.auth.me();
      setUser(me.user);
      setPermissions(me.permissions);
      setExpiresAt(me.session.expiresAt);
      setStatus('signedIn');
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) await endSession();
      else if (status === 'loading') {
        // Session could not be verified at launch (e.g. offline): fall back to sign-in and say why.
        await endSession(e instanceof ApiError ? e.message : undefined);
      }
    }
  }, [endSession, status]);

  // Restore a persisted session on launch.
  useEffect(() => {
    (async () => {
      const saved = await loadToken();
      if (!saved) {
        setStatus('signedOut');
        return;
      }
      setToken(saved);
      await refresh();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-validate on app resume (session may have been revoked by another super admin).
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active' && status === 'signedIn') void refresh();
    });
    return () => sub.remove();
  }, [refresh, status]);

  useEffect(() => {
    registerApiHandlers({ onUnauthorized: () => void endSession('Your session has ended. Please sign in again.') });
  }, [endSession]);

  const signIn = useCallback(async (email: string, password: string) => {
    const res = await api.auth.login(email.trim().toLowerCase(), password);
    setToken(res.token);
    await saveToken(res.token);
    setUser(res.user);
    setPermissions(res.permissions);
    setExpiresAt(res.expiresAt);
    setStatus('signedIn');
  }, []);

  const signOut = useCallback(async () => {
    try {
      await api.auth.logout();
    } catch {
      // Even if the call fails (offline), drop the local session.
    }
    await endSession('You have been signed out.');
  }, [endSession]);

  const can = useCallback(
    (module: ModuleKey, level: Exclude<AccessLevel, 'none'> = 'read') => {
      const p = permissions?.[module] ?? 'none';
      return level === 'read' ? p !== 'none' : p === 'write';
    },
    [permissions],
  );

  const value = useMemo(
    () => ({ status, user, permissions, expiresAt, signIn, signOut, can }),
    [status, user, permissions, expiresAt, signIn, signOut, can],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
