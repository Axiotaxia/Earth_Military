import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { supabase, ROBLOX_CLIENT_ID, OWNER_ROBLOX_ID, DbUser, UserPermissions } from '@/lib/supabase';

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

const SESSION_KEY = 'ek_session_user_id';

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

  const fetchUser = useCallback(async (userId: string): Promise<AuthUser | null> => {
    const { data: dbUser, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    if (error || !dbUser) return null;

    const { data: perms } = await supabase
      .from('user_permissions')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    const isOwner = dbUser.roblox_user_id === OWNER_ROBLOX_ID;

    return {
      ...dbUser,
      permissions: perms,
      is_owner: isOwner,
    };
  }, []);

  const refreshUser = useCallback(async () => {
    const userId = localStorage.getItem(SESSION_KEY);
    if (!userId) {
      setUser(null);
      setLoading(false);
      return;
    }

    const u = await fetchUser(userId);
    if (!u) {
      localStorage.removeItem(SESSION_KEY);
      setUser(null);
    } else {
      setUser(u);
    }
    setLoading(false);
  }, [fetchUser]);

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

      localStorage.setItem(SESSION_KEY, data.user_id);
      await refreshUser();
    },
    [refreshUser]
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