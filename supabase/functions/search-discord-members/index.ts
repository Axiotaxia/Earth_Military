const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const BOT_API_URL = Deno.env.get("BOT_API_URL") || "";
const BOT_API_SECRET = Deno.env.get("BOT_API_SECRET") || "";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const query = url.searchParams.get("q") || "";

    if (!BOT_API_URL || !BOT_API_SECRET) {
      throw new Error("Bot API is not configured (BOT_API_URL / BOT_API_SECRET missing)");
    }

    const botResp = await fetch(
      `${BOT_API_URL}/members/search?q=${encodeURIComponent(query)}`,
      { headers: { Authorization: `Bearer ${BOT_API_SECRET}` } }
    );

    if (!botResp.ok) {
      const text = await botResp.text();
      throw new Error(`Bot search failed: ${text}`);
    }

    const data = await botResp.json();

    return new Response(
      JSON.stringify(data),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
