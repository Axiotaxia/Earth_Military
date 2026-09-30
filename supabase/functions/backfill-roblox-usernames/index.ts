import { createClient } from "npm:@supabase/supabase-js@2.57.4";

/**
 * ONE-TIME FIX. Before this, roblox-oauth mapped Roblox's OIDC "name" claim
 * (which is actually the display name) into roblox_username, and "nickname"
 * (also the display name) into roblox_display_name. The real @username
 * (OIDC "preferred_username") was never captured. That mapping is now fixed
 * for future logins; this function repairs every existing user's row using
 * Roblox's public Users API, which can look up the real username from a
 * user ID with no auth required.
 *
 * Safe to run more than once - it only touches rows where the stored
 * username still equals the stored display name (the symptom of the bug),
 * so already-correct rows are left alone.
 *
 * Delete this function after running it once successfully.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

async function getSupabaseClient() {
  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, serviceKey);
}

interface RobloxUserLookup {
  name: string; // the real @username on this endpoint
  displayName: string;
}

async function fetchRobloxUser(robloxUserId: number): Promise<RobloxUserLookup | null> {
  const resp = await fetch(`https://users.roblox.com/v1/users/${robloxUserId}`);
  if (!resp.ok) return null;
  const data = await resp.json();
  if (!data || !data.name) return null;
  return { name: data.name, displayName: data.displayName || data.name };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = await getSupabaseClient();

    const { data: users, error } = await supabase
      .from("users")
      .select("id, roblox_user_id, roblox_username, roblox_display_name");

    if (error) throw new Error(error.message);

    const results: { id: string; before: string; after: string; status: string }[] = [];

    for (const user of users || []) {
      // Only touch rows showing the bug's symptom: username === display name
      if (
        !user.roblox_username ||
        !user.roblox_display_name ||
        user.roblox_username.toLowerCase() !== user.roblox_display_name.toLowerCase()
      ) {
        continue;
      }

      const before = `${user.roblox_username} / ${user.roblox_display_name}`;

      const lookup = await fetchRobloxUser(user.roblox_user_id);
      if (!lookup) {
        results.push({ id: user.id, before, after: "SKIPPED", status: "roblox lookup failed" });
        continue;
      }

      await supabase
        .from("users")
        .update({
          roblox_username: lookup.name,
          roblox_display_name: lookup.displayName,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      results.push({
        id: user.id,
        before,
        after: `${lookup.name} / ${lookup.displayName}`,
        status: "updated",
      });

      // Be polite to Roblox's public API - small delay between requests
      await new Promise((resolve) => setTimeout(resolve, 150));
    }

    return new Response(
      JSON.stringify({ ok: true, checked: (users || []).length, changed: results.length, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
