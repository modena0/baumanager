import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" }
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors })
  try {
    const { prompt, system } = await req.json()
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": Deno.env.get("ANTHROPIC_KEY") ?? "", "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 500, system: system || "Du bist ein Assistent.", messages: [{ role: "user", content: prompt }] }),
    })
    const d = await res.json()
    return new Response(JSON.stringify({ text: d.content?.[0]?.text || "Keine Antwort" }), { headers: { ...cors, "Content-Type": "application/json" } })
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } })
  }
})