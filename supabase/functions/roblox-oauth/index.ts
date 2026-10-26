import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const ROBLOX_CLIENT_ID = "4235495123293811435";
const ROBLOX_CLIENT_SECRET = Deno.env.get("ROBLOX_CLIENT_SECRET") || "";
const GROUP_ID = 592750791;
const OWNER_ROBLOX_ID = 593587739;
const SESSION_SECRET = Deno.env.get("SESSION_SECRET") || "";
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

function b64url(input: ArrayBuffer | string): string {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : new Uint8Array(input);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Signs a short-lived HS256 session token for the given user. Only the
 * Host Events function trusts it (it re-verifies the signature server-side).
 * Returns null if SESSION_SECRET isn't configured, so normal login keeps
 * working and only hosting stays unavailable until the secret is set.
 */


async function sha256Hex(input: string): Promise<string> {
  const data = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(data)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function signSessionToken(userId: string): Promise<string | null> {
  if (!SESSION_SECRET) return null;
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = b64url(JSON.stringify({ sub: userId, exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS }));
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(SESSION_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${header}.${payload}`));
  return `${header}.${payload}.${b64url(sig)}`;
}


interface RobloxTokenResponse {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in: number;
  id_token?: string;
}

interface RobloxUserInfo {
  sub: string;
  /** Roblox calls this "display name" in its OIDC userinfo response - despite the field name "name". */
  name: string;
  /** Also the display name (Roblox's userinfo response sets this identically to `name`). */
  nickname: string;
  /** The actual unique @username. This is the field that must map to roblox_username. */
  preferred_username: string;
  picture?: string;
}

interface RobloxGroupRole {
  rank: number;
  name: string;
}

async function getSupabaseClient() {
  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, serviceKey);
}

async function exchangeCodeForToken(code: string, redirectUri: string): Promise<RobloxTokenResponse> {
  const body = new URLSearchParams({
    code,
    grant_type: "authorization_code",
    client_id: ROBLOX_CLIENT_ID,
    client_secret: ROBLOX_CLIENT_SECRET,
    redirect_uri: redirectUri,
  });

  const resp = await fetch("https://apis.roblox.com/oauth/v1/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Token exchange failed: ${resp.status} ${text}`);
  }

  return await resp.json();
}

async function getUserInfo(accessToken: string): Promise<RobloxUserInfo> {
  const resp = await fetch("https://apis.roblox.com/oauth/v1/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`UserInfo fetch failed: ${resp.status} ${text}`);
  }

  return await resp.json();
}

async function getUserGroupRank(robloxUserId: string): Promise<RobloxGroupRole> {
  const resp = await fetch(
    `https://groups.roblox.com/v2/users/${robloxUserId}/groups/${GROUP_ID}/roles`,
    {
      headers: { "Content-Type": "application/json" },
    }
  );

  if (!resp.ok) {
    const resp2 = await fetch(
      `https://groups.roblox.com/v1/users/${robloxUserId}/groups/roles`,
      { headers: { "Content-Type": "application/json" } }
    );
    if (!resp2.ok) {
      console.error("[VerificationFlow][ROBLOX_GROUP_LOOKUP_FAILED] userId=" + robloxUserId + " v2Status=" + resp.status + " v1Status=" + resp2.status);
      return { rank: 0, name: "Guest" };
    }
    const data2 = await resp2.json();
    const groupData = data2.data?.find(
      (g: { group: { id: number } }) => g.group.id === GROUP_ID
    );
    if (!groupData) {
      console.info("[VerificationFlow][ROBLOX_NOT_IN_GROUP] userId=" + robloxUserId + " groupId=" + GROUP_ID);
      return { rank: 0, name: "Guest" };
    }
    return { rank: groupData.role?.rank || 0, name: groupData.role?.name || "Guest" };
  }

  const data = await resp.json();
  return { rank: data.rank || 0, name: data.name || "Guest" };
}

Deno.serve(async (req: Request) => {
  let stage = "request_received";
  const respond = (body: Record<string, unknown>, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action") || url.pathname.split("/").pop();

    if (action !== "authorize" && req.method !== "POST") {
      console.warn("[VerificationFlow][UNKNOWN_ACTION] method=" + req.method + " action=" + action);
      return respond({ error: "Unknown action", code: "UNKNOWN_ACTION" }, 400);
    }

    stage = "parse_request";
    const body = await req.json().catch(() => ({}));
    const code = typeof body.code === "string" ? body.code : "";
    const redirectUri = typeof body.redirect_uri === "string" ? body.redirect_uri : "";
    const state = typeof body.state === "string" && body.state.length > 0 ? body.state : null;
    const verificationRequested = state !== null;

    console.info(
      "[VerificationFlow][REQUEST_RECEIVED] method=" + req.method +
      " verificationRequested=" + verificationRequested +
      " hasCode=" + Boolean(code) +
      " hasRedirectUri=" + Boolean(redirectUri) +
      " stateLength=" + (state?.length ?? 0),
    );

    if (!code || !redirectUri) {
      console.error("[VerificationFlow][REQUEST_MISSING_FIELDS] hasCode=" + Boolean(code) + " hasRedirectUri=" + Boolean(redirectUri));
      return respond({ error: "Missing authorization code or redirect URI.", code: "REQUEST_MISSING_FIELDS" }, 400);
    }
    if (state && state.length > 512) {
      console.error("[VerificationFlow][STATE_INVALID_LENGTH] stateLength=" + state.length);
      return respond({ error: "The verification state is invalid. Start again from Discord.", code: "STATE_INVALID_LENGTH" }, 400);
    }

    stage = "roblox_token_exchange";
    console.info("[VerificationFlow][TOKEN_EXCHANGE_STARTED] verificationRequested=" + verificationRequested);
    const tokenData = await exchangeCodeForToken(code, redirectUri);
    console.info("[VerificationFlow][TOKEN_EXCHANGE_SUCCEEDED] verificationRequested=" + verificationRequested);

    stage = "roblox_user_info";
    const userInfo = await getUserInfo(tokenData.access_token);
    const robloxUserId = Number(userInfo.sub);
    if (!Number.isSafeInteger(robloxUserId) || robloxUserId <= 0 || !userInfo.preferred_username) {
      console.error("[VerificationFlow][ROBLOX_USER_INFO_INVALID] hasSub=" + Boolean(userInfo.sub) + " hasUsername=" + Boolean(userInfo.preferred_username));
      return respond({ error: "Roblox returned incomplete account information. Please try again.", code: "ROBLOX_USER_INFO_INVALID" }, 502);
    }
    console.info("[VerificationFlow][ROBLOX_IDENTITY_CONFIRMED] robloxUserId=" + robloxUserId + " verificationRequested=" + verificationRequested);

    stage = "roblox_group_rank";
    const groupRole = await getUserGroupRank(String(robloxUserId));
    console.info("[VerificationFlow][ROBLOX_GROUP_RANK_RESOLVED] robloxUserId=" + robloxUserId + " rank=" + groupRole.rank + " role=" + groupRole.name);

    const supabase = await getSupabaseClient();
    let verificationDiscordId: string | null = null;
    let verificationDiscordUsername: string | null = null;
    let verificationTokenId: string | null = null;

    if (verificationRequested) {
      stage = "verification_token_lookup";
      const tokenHash = await sha256Hex(state!);
      const { data: tokenRow, error: tokenLookupError } = await supabase
        .from("discord_verification_tokens")
        .select("id, discord_id, discord_username")
        .eq("token_hash", tokenHash)
        .is("consumed_at", null)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();

      if (tokenLookupError) {
        console.error("[VerificationFlow][TOKEN_LOOKUP_DB_FAILED] message=" + tokenLookupError.message);
        return respond({ error: "The verification service could not check your link. Try again or create a new link in Discord.", code: "TOKEN_LOOKUP_DB_FAILED" }, 503);
      }
      if (!tokenRow) {
        console.warn("[VerificationFlow][TOKEN_INVALID_EXPIRED_OR_USED] statePresent=true");
        return respond({ error: "This verification link is expired or has already been used. Return to Discord and press Verify to create a new link.", code: "TOKEN_INVALID_EXPIRED_OR_USED" }, 400);
      }

      verificationTokenId = tokenRow.id;
      verificationDiscordId = String(tokenRow.discord_id);
      verificationDiscordUsername = tokenRow.discord_username || null;
      console.info("[VerificationFlow][TOKEN_VALIDATED] tokenRowId=" + verificationTokenId + " discordIdSuffix=" + verificationDiscordId.slice(-4));

      stage = "verification_rank_gate";
      if (groupRole.rank < 2) {
        console.warn("[VerificationFlow][GROUP_RANK_TOO_LOW] robloxUserId=" + robloxUserId + " rank=" + groupRole.rank + " requiredRank=2");
        return respond({ error: "You must be Private or above in the Earth Kingdom Roblox group to verify.", code: "GROUP_RANK_TOO_LOW" }, 403);
      }

      stage = "discord_link_conflict_check";
      const { data: linkedDiscord, error: discordCheckError } = await supabase
        .from("users")
        .select("id, roblox_user_id")
        .eq("discord_id", verificationDiscordId)
        .neq("roblox_user_id", robloxUserId)
        .maybeSingle();

      if (discordCheckError) {
        console.error("[VerificationFlow][DISCORD_LINK_CHECK_DB_FAILED] discordIdSuffix=" + verificationDiscordId.slice(-4) + " message=" + discordCheckError.message);
        return respond({ error: "The verification service could not check your Discord link. Please try again.", code: "DISCORD_LINK_CHECK_DB_FAILED" }, 503);
      }
      if (linkedDiscord) {
        console.warn("[VerificationFlow][DISCORD_ALREADY_LINKED] discordIdSuffix=" + verificationDiscordId.slice(-4) + " otherRobloxUserId=" + linkedDiscord.roblox_user_id);
        return respond({ error: "That Discord account is already linked to a different Military profile.", code: "DISCORD_ALREADY_LINKED" }, 409);
      }

      const { data: linkedRoblox, error: robloxCheckError } = await supabase
        .from("users")
        .select("id, discord_id")
        .eq("roblox_user_id", robloxUserId)
        .maybeSingle();

      if (robloxCheckError) {
        console.error("[VerificationFlow][ROBLOX_LINK_CHECK_DB_FAILED] robloxUserId=" + robloxUserId + " message=" + robloxCheckError.message);
        return respond({ error: "The verification service could not check your Roblox link. Please try again.", code: "ROBLOX_LINK_CHECK_DB_FAILED" }, 503);
      }
      if (linkedRoblox?.discord_id && linkedRoblox.discord_id !== verificationDiscordId) {
        console.warn("[VerificationFlow][ROBLOX_ALREADY_LINKED] robloxUserId=" + robloxUserId + " existingDiscordIdSuffix=" + String(linkedRoblox.discord_id).slice(-4));
        return respond({ error: "That Roblox account is already linked to another Discord account. Contact an administrator if this is incorrect.", code: "ROBLOX_ALREADY_LINKED" }, 409);
      }

      // Atomically claim the single-use token. Only one concurrent callback can win.
      stage = "verification_token_claim";
      const claimedAt = new Date().toISOString();
      const { data: claimedRows, error: claimError } = await supabase
        .from("discord_verification_tokens")
        .update({ consumed_at: claimedAt })
        .eq("id", verificationTokenId)
        .is("consumed_at", null)
        .gt("expires_at", claimedAt)
        .select("id");

      if (claimError) {
        console.error("[VerificationFlow][TOKEN_CLAIM_DB_FAILED] tokenRowId=" + verificationTokenId + " message=" + claimError.message);
        return respond({ error: "The verification service could not reserve your link. Create a new link in Discord and try again.", code: "TOKEN_CLAIM_DB_FAILED" }, 503);
      }
      if (!claimedRows || claimedRows.length !== 1) {
        console.warn("[VerificationFlow][TOKEN_CLAIM_LOST_RACE] tokenRowId=" + verificationTokenId);
        return respond({ error: "This verification link was already used or expired while you were signing in. Create a new link in Discord.", code: "TOKEN_CLAIM_LOST_RACE" }, 409);
      }
      console.info("[VerificationFlow][TOKEN_CLAIMED] tokenRowId=" + verificationTokenId);
    } else {
      console.info("[VerificationFlow][NORMAL_LOGIN_NO_VERIFICATION_STATE] A regular site login was requested; no Discord link will be created.");
    }

    stage = "user_profile_upsert";
    const { data: existingUser, error: existingUserError } = await supabase
      .from("users")
      .select("id")
      .eq("roblox_user_id", robloxUserId)
      .maybeSingle();

    if (existingUserError) {
      console.error("[VerificationFlow][USER_LOOKUP_DB_FAILED] robloxUserId=" + robloxUserId + " message=" + existingUserError.message);
      return respond({ error: "Your Roblox profile could not be loaded from the database. Please try again.", code: "USER_LOOKUP_DB_FAILED" }, 503);
    }

    let userId: string;
    const profilePatch: Record<string, any> = {
      roblox_username: userInfo.preferred_username,
      roblox_display_name: userInfo.name,
      roblox_avatar_url: userInfo.picture ?? null,
      group_rank: groupRole.rank,
      group_rank_name: groupRole.name,
      updated_at: new Date().toISOString(),
    };
    if (verificationRequested) {
      profilePatch.discord_id = verificationDiscordId;
      profilePatch.discord_username = verificationDiscordUsername;
    }

    if (existingUser) {
      const { error: updateError } = await supabase
        .from("users")
        .update(profilePatch)
        .eq("id", existingUser.id);

      if (updateError) {
        console.error("[VerificationFlow][USER_UPDATE_DB_FAILED] robloxUserId=" + robloxUserId + " verificationRequested=" + verificationRequested + " message=" + updateError.message);
        return respond({ error: "Your Roblox profile could not be saved. Please create a new verification link if this was a verification attempt.", code: "USER_UPDATE_DB_FAILED" }, 503);
      }
      userId = existingUser.id;

      if (groupRole.rank >= 5) {
        const { error: promotionCleanupError } = await supabase
          .from("sergeant_promotion_candidates")
          .delete()
          .eq("user_id", userId);
        if (promotionCleanupError) {
          console.error("[VerificationFlow][PROMOTION_CANDIDATE_CLEANUP_FAILED] userId=" + userId + " message=" + promotionCleanupError.message);
        }
      }
    } else {
      const insertRow: Record<string, any> = {
        roblox_user_id: robloxUserId,
        ...profilePatch,
        onboarded: false,
      };
      const { data: newUser, error: insertError } = await supabase
        .from("users")
        .insert(insertRow)
        .select("id")
        .single();

      if (insertError || !newUser) {
        console.error("[VerificationFlow][USER_INSERT_DB_FAILED] robloxUserId=" + robloxUserId + " message=" + (insertError?.message || "No row returned"));
        return respond({ error: "Your Roblox profile could not be created. Please create a new verification link if this was a verification attempt.", code: "USER_INSERT_DB_FAILED" }, 503);
      }
      userId = newUser.id;
    }

    if (verificationRequested) {
      console.info("[VerificationFlow][DISCORD_LINK_SAVED] robloxUserId=" + robloxUserId + " discordIdSuffix=" + verificationDiscordId!.slice(-4) + " userId=" + userId);
    }

    stage = "owner_permissions";
    if (robloxUserId === OWNER_ROBLOX_ID) {
      const { error: permissionError } = await supabase
        .from("user_permissions")
        .upsert({
          user_id: userId,
          can_create_divisions: true,
          can_create_ranks: true,
          can_promote: true,
          can_award_points: true,
          can_view_hr_panel: true,
          can_manage_members: true,
          is_owner: true,
        }, { onConflict: "user_id" });
      if (permissionError) {
        console.error("[VerificationFlow][OWNER_PERMISSION_UPSERT_FAILED] userId=" + userId + " message=" + permissionError.message);
      }
    }

    stage = "session_creation";
    const sessionToken = await signSessionToken(userId);
    console.info("[VerificationFlow][FLOW_SUCCEEDED] robloxUserId=" + robloxUserId + " verification=" + verificationRequested + " userId=" + userId);

    return respond({
      session_token: sessionToken,
      user_id: userId,
      roblox_user_id: robloxUserId,
      roblox_username: userInfo.preferred_username,
      roblox_display_name: userInfo.name,
      roblox_avatar_url: userInfo.picture,
      group_rank: groupRole.rank,
      group_rank_name: groupRole.name,
      verification: verificationRequested,
    });
  } catch (error) {
    console.error(
      "[VerificationFlow][UNHANDLED_STAGE_FAILURE] stage=" + stage +
      " error=" + (error instanceof Error ? error.stack || error.message : String(error)),
    );
    return respond({
      error: "Verification/login failed during stage: " + stage + ". Please try again. If this continues, contact an administrator with code OAUTH_STAGE_FAILURE.",
      code: "OAUTH_STAGE_FAILURE",
      stage,
    }, 500);
  }
});
