import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" }

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors })
  try {
    const { prompt, system, max_tokens, dokumente } = await req.json()

    // Nachrichten-Inhalt aufbauen
    const content: any[] = []

    // Dokumente (PDFs/Bilder) hinzufügen wenn vorhanden
    if (dokumente && dokumente.length > 0) {
      for (const dok of dokumente) {
        if (dok.type === "pdf") {
          content.push({
            type: "document",
            source: {
              type: "base64",
              media_type: "application/pdf",
              data: dok.data,
            },
          })
        } else if (dok.type === "image") {
          content.push({
            type: "image",
            source: {
              type: "base64",
              media_type: dok.media_type || "image/jpeg",
              data: dok.data,
            },
          })
        }
      }
    }

    // Text-Prompt hinzufügen
    content.push({ type: "text", text: prompt })

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": Deno.env.get("ANTHROPIC_KEY") ?? "",
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "pdfs-2024-09-25",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: max_tokens || 500,
        system: system || "Du bist ein Assistent.",
        messages: [{ role: "user", content }],
      }),
    })

    const d = await res.json()
    if (d.error) return new Response(JSON.stringify({ error: d.error.message }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } })
    return new Response(JSON.stringify({ text: d.content?.[0]?.text || "Keine Antwort" }), { headers: { ...cors, "Content-Type": "application/json" } })
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } })
  }
})