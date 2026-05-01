import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors })

  try {
    const { prompt, system, max_tokens, file_ids, dokumente } = await req.json()
    const ANTHROPIC_KEY = Deno.env.get("ANTHROPIC_KEY") ?? ""
    const content: any[] = []

    // PDFs per file_id (Anthropic Files API)
    if (file_ids && file_ids.length > 0) {
      for (const file_id of file_ids) {
        content.push({
          type: "document",
          source: {
            type: "file",
            file_id: file_id,
          },
        })
      }
    }

    // Bilder und Texte direkt
    if (dokumente && dokumente.length > 0) {
      for (const dok of dokumente) {
        if (dok.type === "image_base64") {
          content.push({
            type: "image",
            source: { type: "base64", media_type: dok.media_type || "image/jpeg", data: dok.data },
          })
        } else if (dok.type === "text") {
          content.push({ type: "text", text: `=== ${dok.name} ===\n${dok.data}` })
        }
      }
    }

    content.push({ type: "text", text: prompt })

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "files-api-2025-04-14",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: max_tokens || 500,
        system: system || "Du bist ein Assistent.",
        messages: [{ role: "user", content }],
      }),
    })

    const d = await res.json()
    if (d.error) {
      return new Response(JSON.stringify({ error: d.error.message }), {
        status: 500, headers: { ...cors, "Content-Type": "application/json" }
      })
    }

    return new Response(
      JSON.stringify({ text: d.content?.[0]?.text || "Keine Antwort" }),
      { headers: { ...cors, "Content-Type": "application/json" } }
    )
  } catch (e: any) {
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
    )
  }
})