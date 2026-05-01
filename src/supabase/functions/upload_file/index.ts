import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors })

  try {
    const { filename, media_type, data } = await req.json()
    const ANTHROPIC_KEY = Deno.env.get("ANTHROPIC_KEY") ?? ""

    // base64 zu Uint8Array konvertieren
    const binary = atob(data)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i)
    }

    // FormData für Anthropic Files API
    const formData = new FormData()
    const blob = new Blob([bytes], { type: media_type || "application/pdf" })
    formData.append("file", blob, filename)

    const res = await fetch("https://api.anthropic.com/v1/files", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "files-api-2025-04-14",
      },
      body: formData,
    })

    const d = await res.json()
    if (!res.ok || d.error) {
      return new Response(JSON.stringify({ error: d.error?.message || "Upload fehlgeschlagen" }), {
        status: 500, headers: { ...cors, "Content-Type": "application/json" }
      })
    }

    return new Response(
      JSON.stringify({ file_id: d.id }),
      { headers: { ...cors, "Content-Type": "application/json" } }
    )
  } catch (e: any) {
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
    )
  }
})