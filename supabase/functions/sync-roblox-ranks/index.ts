import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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
    { headers: { "Content-Type": "application/json" } },
  );

  if (!resp.ok) {
    const resp2 = await fetch(
      `https://groups.roblox.com/v1/users/${robloxUserId}/groups/roles`,
      { headers: { "Content-Type": "application/json" } },
    );

    if (!resp2.ok) return { rank: 0, name: "Guest" };

    const data2 = await resp2.json();
    const groupData = data2.data?.find(
      (g: { group: { id: number } }) => g.group.id === GROUP_ID,
    );

    if (!groupData) return { rank: 0, name: "Guest" };

    return {
      rank: groupData.role?.rank || 0,
      name: groupData.role?.name || "Guest",
    };
  }

  const data = await resp.json();
  return {
    rank: data.rank || 0,
    name: data.name || "Guest",
  };
}

async function getSupabaseClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  try {
    const supabase = await getSupabaseClient();

    const { data: users, error } = await supabase
      .from("users")
      .select("id, roblox_user_id, group_rank, group_rank_name");

    if (error) throw error;

    let checked = 0;
    let updated = 0;
    const changes: { user_id: string; old_rank: number; new_rank: number; new_rank_name: string }[] = [];

    for (let i = 0; i < (users || []).length; i += 10) {
      const batch = (users || []).slice(i, i + 10);

      const results = await Promise.all(
        batch.map(async (user) => ({
          user,
          role: await getUserGroupRank(Number(user.roblox_user_id)),
        })),
      );

      for (const { user, role } of results) {
        checked++;

        if (role.rank === user.group_rank && role.name === user.group_rank_name) {
          continue;
        }

        const { error: updateError } = await supabase
          .from("users")
          .update({
            group_rank: role.rank,
            group_rank_name: role.name,
            updated_at: new Date().toISOString(),
          })
          .eq("id", user.id);

        if (updateError) throw updateError;

        updated++;
        changes.push({
          user_id: user.id,
          old_rank: user.group_rank,
          new_rank: role.rank,
          new_rank_name: role.name,
        });

        if (role.rank >= SERGEANT_RANK) {
          await supabase
            .from("sergeant_promotion_candidates")
            .delete()
            .eq("user_id", user.id);
        }
      }
    }

    return new Response(
      JSON.stringify({ checked, updated, changes }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
