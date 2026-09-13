import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { ROBLOX_CLIENT_ID, DbUser, UserPermissions } from '@/lib/supabase';

interface AuthUser extends DbUser {
  permissions: UserPermissions | null;
  is_owner: boolean;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  robloxAuthUrl: string;
  loginWithRoblox: () => void;
  handleOAuthCallback: (code: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const SESSION_KEY = 'ek_session_user';

function getBaseUrl(): string {
  return window.location.origin;
}

function buildRobloxAuthUrl(): string {
  const redirectUri = `${getBaseUrl()}/redirect`;
  const scopes = 'openid profile';
  const params = new URLSearchParams({
    client_id: ROBLOX_CLIENT_ID,
    redirect_uri: redirectUri,
    scope: scopes,
    response_type: 'code',
  });
  return `https://apis.roblox.com/oauth/v1/authorize?${params.toString()}`;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [robloxAuthUrl] = useState(() => buildRobloxAuthUrl());

  const refreshUser = useCallback(async () => {
    const stored = localStorage.getItem(SESSION_KEY);
    if (!stored) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const parsed: AuthUser = JSON.parse(stored);
      setUser(parsed);
    } catch {
      localStorage.removeItem(SESSION_KEY);
      setUser(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const loginWithRoblox = useCallback(() => {
    window.location.href = buildRobloxAuthUrl();
  }, []);

  const handleOAuthCallback = useCallback(
    async (code: string) => {
      const redirectUri = `${getBaseUrl()}/redirect`;
      const funcUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/roblox-oauth`;

      const resp = await fetch(funcUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ code, redirect_uri: redirectUri }),
      });

      if (!resp.ok) {
        const errText = await resp.text();
        throw new Error(`OAuth failed: ${errText}`);
      }

      const data = await resp.json();
      if (data.error) throw new Error(data.error);

      const authUser: AuthUser = {
        ...data.user,
        permissions: data.permissions,
        is_owner: data.is_owner,
      };

      localStorage.setItem(SESSION_KEY, JSON.stringify(authUser));
      setUser(authUser);
      setLoading(false);
    },
    []
  );

  const logout = useCallback(() => {
    localStorage.removeItem(SESSION_KEY);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, loading, robloxAuthUrl, loginWithRoblox, handleOAuthCallback, logout, refreshUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}