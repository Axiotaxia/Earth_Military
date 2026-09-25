import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const GROUP_ID = 592750791;
const SERGEANT_RANK = 5;

interface RobloxGroupRole {
  rank: number;
  name: string;
}

async function getUserGroupRank(robloxUserId: number): Promise<RobloxGroupRole> {
  const resp = await fetch(
    `https://groups.roblox.com/v2/users/${robloxUserId}/groups/${GROUP_ID}/roles`,
    { headers: { "Content-Type": "application/json" } }
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

async function getSupabaseClient() {
  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, serviceKey);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = await getSupabaseClient();

    // Load current candidates and their linked users
    const { data: candidates, error: candidatesError } = await supabase
      .from("sergeant_promotion_candidates")
      .select("id, user_id");

    if (candidatesError) throw candidatesError;
    if (!candidates || candidates.length === 0) {
      return new Response(
        JSON.stringify({ checked: 0, promoted: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userIds = candidates.map((c) => c.user_id);
    const { data: users, error: usersError } = await supabase
      .from("users")
      .select("id, roblox_user_id, group_rank, group_rank_name")
      .in("id", userIds);

    if (usersError) throw usersError;

    const promoted: { user_id: string; roblox_username: string | null; new_rank_name: string }[] = [];

    for (const user of users || []) {
      const role = await getUserGroupRank(user.roblox_user_id);

      if (role.rank !== user.group_rank) {
        await supabase
          .from("users")
          .update({
            group_rank: role.rank,
            group_rank_name: role.name,
            updated_at: new Date().toISOString(),
          })
          .eq("id", user.id);
      }

      if (role.rank >= SERGEANT_RANK) {
        await supabase
          .from("sergeant_promotion_candidates")
          .delete()
          .eq("user_id", user.id);

        promoted.push({
          user_id: user.id,
          roblox_username: null,
          new_rank_name: role.name,
        });
      }
    }

    return new Response(
      JSON.stringify({ checked: (users || []).length, promoted }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
