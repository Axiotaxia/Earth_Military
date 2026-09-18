import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import {
  supabase, ROBLOX_CLIENT_ID, OWNER_ROBLOX_ID, DbUser, UserPermissions,
} from '@/lib/supabase';

export interface EffectivePermissions {
  can_create_divisions: boolean;
  can_create_ranks: boolean;
  can_promote: boolean;
  can_award_points: boolean;
  can_view_hr_panel: boolean;
  can_manage_members: boolean;
  can_edit_point_types: boolean;
}

const PERMISSION_KEYS: (keyof EffectivePermissions)[] = [
  'can_create_divisions',
  'can_create_ranks',
  'can_promote',
  'can_award_points',
  'can_view_hr_panel',
  'can_manage_members',
  'can_edit_point_types',
];

const NO_PERMISSIONS: EffectivePermissions = {
  can_create_divisions: false,
  can_create_ranks: false,
  can_promote: false,
  can_award_points: false,
  can_view_hr_panel: false,
  can_manage_members: false,
  can_edit_point_types: false,
};

interface AuthUser extends DbUser {
  permissions: UserPermissions | null;
  is_owner: boolean;
  effective_permissions: EffectivePermissions;
  division_id: string | null;
  division_rank_id: string | null;
  /**
   * Whether can_promote came from a global source (owner, user_permissions, or
   * group rank permissions) or only from the user's division rank. Division-only
   * promoters are restricted to promoting members with no division or their own
   * division; global promoters can promote in any division.
   */
  promote_scope: 'global' | 'division_only' | 'none';
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

    const isOwner = dbUser.roblox_user_id === OWNER_ROBLOX_ID;

    const [permsRes, groupPermsRes, memberRes] = await Promise.all([
      supabase.from('user_permissions').select('*').eq('user_id', userId).maybeSingle(),
      supabase.from('group_rank_permissions').select('*').eq('group_rank', dbUser.group_rank).maybeSingle(),
      supabase.from('division_members').select('division_id, division_rank_id').eq('user_id', userId).maybeSingle(),
    ]);

    const perms = permsRes.data;
    const groupPerms = groupPermsRes.data;
    const member = memberRes.data;

    let divisionRank: Record<string, boolean> | null = null;
    if (member?.division_rank_id) {
      const { data: rank } = await supabase
        .from('division_ranks')
        .select('*')
        .eq('id', member.division_rank_id)
        .maybeSingle();
      divisionRank = rank;
    }

    const effective: EffectivePermissions = isOwner
      ? {
          can_create_divisions: true,
          can_create_ranks: true,
          can_promote: true,
          can_award_points: true,
          can_view_hr_panel: true,
          can_manage_members: true,
          can_edit_point_types: true,
        }
      : PERMISSION_KEYS.reduce((acc, key) => {
          acc[key] = !!(perms?.[key] || groupPerms?.[key] || divisionRank?.[key]);
          return acc;
        }, { ...NO_PERMISSIONS });

    const canPromoteGlobally = isOwner || !!perms?.can_promote || !!groupPerms?.can_promote;
    const canPromoteViaDivision = !!divisionRank?.can_promote;
    const promoteScope: AuthUser['promote_scope'] = canPromoteGlobally
      ? 'global'
      : canPromoteViaDivision
        ? 'division_only'
        : 'none';

    return {
      ...dbUser,
      permissions: perms,
      is_owner: isOwner,
      effective_permissions: effective,
      division_id: member?.division_id || null,
      division_rank_id: member?.division_rank_id || null,
      promote_scope: promoteScope,
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