import { createClient } from "npm:@supabase/supabase-js@2.57.4";

/**
 * Single entry point for everything the Host Events UI needs. Every request
 * must carry a signed session token (issued by roblox-oauth at login) in the
 * X-Session-Token header. The token is verified here, the user is loaded from
 * the database, and can_host_events is checked server-side on every call, so
 * knowing the public anon key is not enough to reach the bot.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, X-Session-Token",
};

const OWNER_ROBLOX_ID = 593587739;
const MIN_SITE_ACCESS_RANK = 2;
const MAX_OPEN_EVENTS_PER_HOST = 5;
const MAX_SCHEDULE_AHEAD_MS = 60 * 24 * 60 * 60 * 1000;

const SESSION_SECRET = Deno.env.get("SESSION_SECRET") || "";
const BOT_API_URL = (Deno.env.get("BOT_API_URL") || "").replace(/\/$/, "");
const BOT_API_SECRET = Deno.env.get("BOT_API_SECRET") || "";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// ---------- session token verification (HS256) ----------
function b64urlToBytes(s: string): Uint8Array {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function verifySessionToken(token: string): Promise<string> {
  try {
    return await verifySessionTokenUnsafe(token);
  } catch (e) {
    if (e instanceof HttpError) throw e;
    throw new HttpError(401, "Invalid session");
  }
}

async function verifySessionTokenUnsafe(token: string): Promise<string> {
  if (!SESSION_SECRET) throw new HttpError(500, "Server is missing SESSION_SECRET");
  const parts = token.split(".");
  if (parts.length !== 3) throw new HttpError(401, "Invalid session");

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(SESSION_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const ok = await crypto.subtle.verify(
    "HMAC",
    key,
    b64urlToBytes(parts[2]),
    new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
  );
  if (!ok) throw new HttpError(401, "Invalid session");

  const payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(parts[1])));
  if (!payload.sub || typeof payload.exp !== "number" || payload.exp * 1000 < Date.now()) {
    throw new HttpError(401, "Session expired - please sign in again");
  }
  return payload.sub as string;
}

// ---------- permission check (mirrors the site's effective-permission merge) ----------
// Passes if the user holds ANY of the given permissions via their own row,
// their Roblox group rank, or their division rank. The owner always passes.
async function requireAnyPermission(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  keys: string[],
) {
  const { data: user } = await supabase.from("users").select("*").eq("id", userId).maybeSingle();
  if (!user) throw new HttpError(401, "Unknown user");
  if (user.group_rank < MIN_SITE_ACCESS_RANK) throw new HttpError(403, "Rank requirement not met");

  const isOwner = user.roblox_user_id === OWNER_ROBLOX_ID;
  if (isOwner) return { user, isOwner };

  const [perms, groupPerms, member] = await Promise.all([
    supabase.from("user_permissions").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("group_rank_permissions").select("*").eq("group_rank", user.group_rank).maybeSingle(),
    supabase.from("division_members").select("division_rank_id").eq("user_id", userId).maybeSingle(),
  ]);

  let divisionRank: Record<string, unknown> | null = null;
  if (member.data?.division_rank_id) {
    const { data: rank } = await supabase
      .from("division_ranks").select("*").eq("id", member.data.division_rank_id).maybeSingle();
    divisionRank = rank;
  }

  const allowed = keys.some((k) => perms.data?.[k] || groupPerms.data?.[k] || divisionRank?.[k]);
  if (!allowed) throw new HttpError(403, "You do not have permission to do that");
  return { user, isOwner };
}

// ---------- bot calls ----------
async function callBot(path: string, init: RequestInit = {}) {
  if (!BOT_API_URL || !BOT_API_SECRET) throw new HttpError(500, "Bot API is not configured");
  const resp = await fetch(`https://${BOT_API_URL}${path}`, {
    ...init,
    headers: { ...(init.headers || {}), Authorization: `Bearer ${BOT_API_SECRET}`, "Content-Type": "application/json" },
  });
  if (!resp.ok) throw new HttpError(502, `Bot error: ${(await resp.text()).slice(0, 200)}`);
  return resp.json();
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const token = req.headers.get("x-session-token");
    if (!token) throw new HttpError(401, "Not signed in with a session token - sign out and back in");

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const userId = await verifySessionToken(token);

    const body = await req.json().catch(() => ({}));
    const action = body.action as string;

    // Points awarders may look people up by Discord name; everything else is host-only.
    const keys = action === "search-players" ? ["can_award_points", "can_host_events"] : ["can_host_events"];
    const { user, isOwner } = await requireAnyPermission(supabase, userId, keys);

    if (action === "search-members") {
      const q = String(body.q || "").slice(0, 50);
      return json(await callBot(`/members/search?q=${encodeURIComponent(q)}`));
    }

    if (action === "set-discord-identity") {
      const discordId = String(body.discordId || "");
      if (!/^\d{15,25}$/.test(discordId)) throw new HttpError(400, "Invalid Discord ID");

      const result = await callBot("/identity/verify", {
        method: "POST",
        body: JSON.stringify({ discordId, robloxUserId: user.roblox_user_id }),
      });

      if (!result.verified) {
        const reasons: Record<string, string> = {
          mismatch: "That Discord account is linked to a different Roblox account in Bloxlink.",
          not_linked: "That Discord account isn't linked to any Roblox account in Bloxlink.",
          not_configured: "Identity verification isn't configured on the bot yet (missing Bloxlink API key).",
          error: "Couldn't reach Bloxlink to verify. Try again in a moment.",
        };
        throw new HttpError(403, reasons[result.reason] || "Could not verify that Discord account");
      }

      await supabase.from("users")
        .update({ discord_id: discordId, discord_username: String(body.username || "").slice(0, 64) })
        .eq("id", user.id);
      return json({ ok: true });
    }

    if (action === "create-double-exam") {
      if (!user.discord_id) throw new HttpError(400, "Identify your Discord account first");

      const scheduledFor = new Date(String(body.scheduledFor));
      const delta = scheduledFor.getTime() - Date.now();
      if (Number.isNaN(delta) || delta < 60_000 || delta > MAX_SCHEDULE_AHEAD_MS) {
        throw new HttpError(400, "Schedule between 1 minute and 60 days from now");
      }

      const { count } = await supabase.from("events").select("id", { count: "exact", head: true })
        .eq("host_user_id", user.id).in("status", ["draft", "posted", "ready", "started"]);
      if ((count || 0) >= MAX_OPEN_EVENTS_PER_HOST) {
        throw new HttpError(429, "You already have too many open events. Finish or cancel one first.");
      }

      const { data: event, error } = await supabase.from("events").insert({
        event_type: "double_exam",
        status: "draft",
        host_user_id: user.id,
        host_discord_id: user.discord_id,
        scheduled_for: scheduledFor.toISOString(),
      }).select().single();
      if (error || !event) throw new HttpError(500, error?.message || "Failed to create event");

      const { error: slotsError } = await supabase.from("event_cohost_slots").insert([
        { event_id: event.id, slot_index: 1, label: "Citizen \u2192 Private Exam" },
        { event_id: event.id, slot_index: 2, label: "Private \u2192 Soldier Exam" },
      ]);
      if (slotsError) throw new HttpError(500, slotsError.message);

      try {
        await callBot(`/events/${event.id}/post-double-exam`, { method: "POST" });
      } catch (e) {
        await supabase.from("events").update({ status: "cancelled", cancelled_at: new Date().toISOString() }).eq("id", event.id);
        throw e;
      }
      return json({ ok: true, eventId: event.id });
    }

    // Loads an event and makes sure the caller may manage it (its host, or the owner)
    const loadOwnEvent = async (eventId: string) => {
      const { data: event } = await supabase.from("events").select("*").eq("id", eventId).maybeSingle();
      if (!event) throw new HttpError(404, "Event not found");
      if (event.host_user_id !== user.id && !isOwner) throw new HttpError(403, "Not your event");
      return event;
    };

    if (action === "search-players") {
      const q = String(body.q || "").slice(0, 50);
      const linked = await callBot(`/members/search-linked?q=${encodeURIComponent(q)}`);
      const ids = (linked.members || []).filter((m: { robloxId: string | null }) => m.robloxId).map((m: { robloxId: string }) => Number(m.robloxId));
      if (ids.length === 0) return json({ players: [] });

      const { data: rows } = await supabase.from("users").select("id, roblox_user_id").in("roblox_user_id", ids);
      const players = (rows || []).map((u) => {
        const m = linked.members.find((x: { robloxId: string }) => Number(x.robloxId) === u.roblox_user_id);
        return { userId: u.id, discordDisplayName: m?.displayName || null, discordUsername: m?.username || null };
      });
      return json({ players });
    }

    if (action === "force-unclaim") {
      const event = await loadOwnEvent(String(body.eventId || ""));
      if (event.status !== "posted") throw new HttpError(409, "This event is no longer taking co-hosts");
      const slotIndex = Number(body.slotIndex);
      const { error } = await supabase.from("event_cohost_slots")
        .update({ claimed_by_discord_id: null, claimed_by_discord_username: null, claimed_by_roblox_user_id: null, claimed_at: null })
        .eq("event_id", event.id).eq("slot_index", slotIndex);
      if (error) throw new HttpError(500, error.message);
      await callBot(`/events/${event.id}/refresh`, { method: "POST" }).catch(() => null);
      return json({ ok: true });
    }

    if (action === "start-event") {
      const event = await loadOwnEvent(String(body.eventId || ""));
      if (event.event_type !== "double_exam") throw new HttpError(400, "Unsupported event type");
      const activities = { slot_1: !!body.activities?.slot_1, slot_2: !!body.activities?.slot_2 };
      if (!activities.slot_1 && !activities.slot_2) throw new HttpError(400, "Pick at least one exam to run");
      await callBot(`/events/${event.id}/start-double-exam`, { method: "POST", body: JSON.stringify({ activities }) });
      return json({ ok: true });
    }

    if (action === "cancel-event") {
      const event = await loadOwnEvent(String(body.eventId || ""));
      if (!["draft", "posted"].includes(event.status)) throw new HttpError(409, "Only events that haven't started can be cancelled");
      const { data: moved } = await supabase.from("events")
        .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
        .eq("id", event.id).in("status", ["draft", "posted"]).select("id");
      if (!moved || moved.length === 0) throw new HttpError(409, "Event state changed - refresh and try again");
      // Clear any co-host claims so those people are free to claim other events
      await supabase.from("event_cohost_slots")
        .update({ claimed_by_discord_id: null, claimed_by_discord_username: null, claimed_by_roblox_user_id: null, claimed_at: null })
        .eq("event_id", event.id);
      await callBot(`/events/${event.id}/poll`, { method: "DELETE" }).catch(() => null);
      return json({ ok: true });
    }

    if (action === "vote-counts") {
      const eventId = String(body.eventId || "");
      const { data: event } = await supabase.from("events").select("host_user_id").eq("id", eventId).maybeSingle();
      if (!event) throw new HttpError(404, "Event not found");
      if (event.host_user_id !== user.id && !isOwner) throw new HttpError(403, "Not your event");

      const { data: votes } = await supabase.from("event_poll_votes").select("option_key").eq("event_id", eventId);
      const counts = { slot_1: 0, slot_2: 0 };
      for (const v of votes || []) if (v.option_key in counts) counts[v.option_key as "slot_1" | "slot_2"]++;
      return json(counts);
    }

    throw new HttpError(400, "Unknown action");
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, status);
  }
});
