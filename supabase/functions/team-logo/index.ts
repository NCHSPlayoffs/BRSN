import { fetchTeamLogo } from "../_shared/team-logo.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
};

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "GET") return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  try {
    const value = new URL(req.url).searchParams.get("url") || "";
    try { return await fetchTeamLogo(value, corsHeaders); }
    catch { return await fetchTeamLogo(value, corsHeaders, true); }
  } catch {
    return new Response("Team logo unavailable", { status: 400, headers: corsHeaders });
  }
});
