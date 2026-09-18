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

interface RobloxTokenResponse {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in: number;
  id_token?: string;
}

interface RobloxUserInfo {
  sub: string;
  name: string;
  nickname: string;
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
    if (!resp2.ok) return { rank: 0, name: "Guest" };
    const data2 = await resp2.json();
    const groupData = data2.data?.find(
      (g: { group: { id: number } }) => g.group.id === GROUP_ID
    );
    if (!groupData) return { rank: 0, name: "Guest" };
    return { rank: groupData.role?.rank || 0, name: groupData.role?.name || "Guest" };
  }

  const data = await resp.json();
  return { rank: data.rank || 0, name: data.name || "Guest" };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action") || url.pathname.split("/").pop();

    if (action === "authorize" || req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const { code, redirect_uri } = body;

      if (!code || !redirect_uri) {
        return new Response(
          JSON.stringify({ error: "Missing code or redirect_uri" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const tokenData = await exchangeCodeForToken(code, redirect_uri);
      const userInfo = await getUserInfo(tokenData.access_token);
      const robloxUserId = parseInt(userInfo.sub, 10);
      const groupRole = await getUserGroupRank(userInfo.sub);

      const supabase = await getSupabaseClient();

      // Upsert user
      const { data: existingUser } = await supabase
        .from("users")
        .select("id")
        .eq("roblox_user_id", robloxUserId)
        .maybeSingle();

      let userId: string;

      if (existingUser) {
        userId = existingUser.id;
        await supabase
          .from("users")
          .update({
            roblox_username: userInfo.name,
            roblox_display_name: userInfo.nickname,
            roblox_avatar_url: userInfo.picture,
            group_rank: groupRole.rank,
            group_rank_name: groupRole.name,
            updated_at: new Date().toISOString(),
          })
          .eq("id", userId);
      } else {
        const { data: newUser, error } = await supabase
          .from("users")
          .insert({
            roblox_user_id: robloxUserId,
            roblox_username: userInfo.name,
            roblox_display_name: userInfo.nickname,
            roblox_avatar_url: userInfo.picture,
            group_rank: groupRole.rank,
            group_rank_name: groupRole.name,
            onboarded: false,
          })
          .select("id")
          .single();

        if (error) throw new Error(`Failed to create user: ${error.message}`);
        userId = newUser.id;
      }

      // Ensure owner permissions for the site owner
      if (robloxUserId === OWNER_ROBLOX_ID) {
        await supabase
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
      }

      return new Response(
        JSON.stringify({
          user_id: userId,
          roblox_user_id: robloxUserId,
          roblox_username: userInfo.name,
          roblox_display_name: userInfo.nickname,
          roblox_avatar_url: userInfo.picture,
          group_rank: groupRole.rank,
          group_rank_name: groupRole.name,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Unknown action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
