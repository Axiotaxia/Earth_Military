import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const BOT_API_URL = Deno.env.get("BOT_API_URL") || "";
const BOT_API_SECRET = Deno.env.get("BOT_API_SECRET") || "";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { hostUserId, hostDiscordId, scheduledFor } = await req.json();

    if (!hostUserId || !scheduledFor) {
      return new Response(
        JSON.stringify({ error: "hostUserId and scheduledFor are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Create the event row
    const { data: event, error: eventError } = await supabase
      .from("events")
      .insert({
        event_type: "double_exam",
        status: "draft",
        host_user_id: hostUserId,
        host_discord_id: hostDiscordId || null,
        scheduled_for: scheduledFor,
      })
      .select()
      .single();

    if (eventError || !event) {
      throw new Error(eventError?.message || "Failed to create event");
    }

    // 2. Create its two co-host slots
    const { error: slotsError } = await supabase.from("event_cohost_slots").insert([
      { event_id: event.id, slot_index: 1, label: "Citizen \u2192 Private Exam" },
      { event_id: event.id, slot_index: 2, label: "Private \u2192 Soldier Exam" },
    ]);

    if (slotsError) throw new Error(slotsError.message);

    // 3. Ask the bot to post the poll + co-host request messages
    if (!BOT_API_URL || !BOT_API_SECRET) {
      throw new Error("Bot API is not configured (BOT_API_URL / BOT_API_SECRET missing)");
    }

    const botResp = await fetch(`${BOT_API_URL}/events/${event.id}/post-double-exam`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${BOT_API_SECRET}`,
        "Content-Type": "application/json",
      },
    });

    if (!botResp.ok) {
      const text = await botResp.text();
      // Roll the event back to draft so the host can retry rather than being
      // stuck with a half-created event that never got posted.
      await supabase.from("events").update({ status: "draft" }).eq("id", event.id);
      throw new Error(`Bot failed to post event: ${text}`);
    }

    return new Response(
      JSON.stringify({ ok: true, eventId: event.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
