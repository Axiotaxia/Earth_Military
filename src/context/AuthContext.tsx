import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { setSessionToken } from '@/lib/session';
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
  can_host_events: boolean;
}

const PERMISSION_KEYS: (keyof EffectivePermissions)[] = [
  'can_create_divisions',
  'can_create_ranks',
  'can_promote',
  'can_award_points',
  'can_view_hr_panel',
  'can_manage_members',
  'can_edit_point_types',
  'can_host_events',
];

const NO_PERMISSIONS: EffectivePermissions = {
  can_create_divisions: false,
  can_create_ranks: false,
  can_promote: false,
  can_award_points: false,
  can_view_hr_panel: false,
  can_manage_members: false,
  can_edit_point_types: false,
  can_host_events: false,
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
  loginWithRoblox: (state?: string) => void;
  handleOAuthCallback: (code: string, state?: string) => Promise<{ verification: boolean }>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const SESSION_KEY = 'ek_session_user_id';
const VERIFICATION_PENDING_KEY = 'ek_discord_verification_pending';
const PENDING_TTL_MS = 10 * 60 * 1000;

function savePendingToken(token: string) {
  sessionStorage.setItem(VERIFICATION_PENDING_KEY, token);
  try {
    localStorage.setItem(VERIFICATION_PENDING_KEY, JSON.stringify({ token, at: Date.now() }));
  } catch { /* storage blocked */ }
}

function readPendingToken(): string | null {
  const fromSession = sessionStorage.getItem(VERIFICATION_PENDING_KEY);
  if (fromSession) return fromSession;
  try {
    const raw = localStorage.getItem(VERIFICATION_PENDING_KEY);
    if (!raw) return null;
    const { token, at } = JSON.parse(raw);
    return token && Date.now() - at < PENDING_TTL_MS ? String(token) : null;
  } catch {
    return null;
  }
}

function clearPendingToken() {
  sessionStorage.removeItem(VERIFICATION_PENDING_KEY);
  try { localStorage.removeItem(VERIFICATION_PENDING_KEY); } catch { /* storage blocked */ }
}

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
          can_host_events: true,
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

  const loginWithRoblox = useCallback((state?: string) => {
    // Login.tsx passes the click event here; only a real string token counts.
    const token = typeof state === 'string' && state.length > 0 ? state : undefined;
    const url = new URL(buildRobloxAuthUrl());
    if (token) {
      savePendingToken(token);
      url.searchParams.set('state', token);
      console.info('[VerificationFlow][BROWSER_OAUTH_STARTED] verificationStateAttached=true');
    } else {
      clearPendingToken();
    }
    window.location.href = url.toString();
  }, []);

  const handleOAuthCallback = useCallback(
    async (code: string, state?: string) => {
      const pendingState = readPendingToken();
      const verificationPending = Boolean(pendingState);
      // Roblox may omit OAuth state. Recover the single-use Discord token from browser storage.
      const effectiveState = state || pendingState || undefined;
      if (verificationPending && !effectiveState) {
        clearPendingToken();
        console.error('[VerificationFlow][BROWSER_STATE_MISSING] Verification was pending but neither callback nor session contained state.');
        throw new Error('Discord verification failed because its token was missing. Return to Discord and press Verify to create a new link. (STATE_MISSING)');
      }

      const redirectUri = `${getBaseUrl()}/redirect`;
      const funcUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/roblox-oauth`;

      console.info('[VerificationFlow][BROWSER_CALLBACK_RECEIVED] verificationPending=' + verificationPending + ' statePresent=' + Boolean(effectiveState));
      let resp: Response;
      try {
        resp = await fetch(funcUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ code, redirect_uri: redirectUri, state: effectiveState || null }),
        });
      } catch (error) {
        clearPendingToken();
        console.error('[VerificationFlow][BROWSER_FUNCTION_REQUEST_FAILED]', error);
        throw new Error('Could not contact the verification service. Check your connection and create a new link in Discord. (FUNCTION_REQUEST_FAILED)');
      }

      let data: any;
      try {
        data = await resp.json();
      } catch {
        clearPendingToken();
        console.error('[VerificationFlow][BROWSER_INVALID_FUNCTION_RESPONSE] status=' + resp.status);
        throw new Error('The verification service returned an unreadable response. Please try again. (INVALID_FUNCTION_RESPONSE)');
      }

      if (!resp.ok || data.error) {
        clearPendingToken();
        const code = typeof data.code === 'string' ? data.code : 'OAUTH_REQUEST_FAILED';
        console.error('[VerificationFlow][BROWSER_FUNCTION_REJECTED] status=' + resp.status + ' code=' + code + ' message=' + (data.error || 'Unknown error'));
        throw new Error((data.error || 'Authentication failed.') + ' (' + code + ')');
      }

      if (verificationPending && data.verification !== true) {
        clearPendingToken();
        console.error('[VerificationFlow][BROWSER_VERIFICATION_NOT_CONFIRMED] state was sent but backend did not confirm verification.');
        throw new Error('The server did not confirm the Discord account link. No success was reported. Please create a new link in Discord. (VERIFICATION_NOT_CONFIRMED)');
      }

      clearPendingToken();
      localStorage.setItem(SESSION_KEY, data.user_id);
      // Older deployments of the login function don't issue a token; the rest
      // of the site still works, only Host Events needs it.
      setSessionToken(data.session_token || null);
      await refreshUser();
      console.info('[VerificationFlow][BROWSER_AUTH_SUCCEEDED] verification=' + Boolean(data.verification));
      return { verification: !!data.verification };
    },
    [refreshUser]
  );

  const logout = useCallback(() => {
    localStorage.removeItem(SESSION_KEY);
    setSessionToken(null);
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