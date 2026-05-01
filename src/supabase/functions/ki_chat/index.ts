import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors })

  try {
    const { prompt, system, max_tokens, pdf_urls, dokumente } = await req.json()

    const content: any[] = []

    // PDFs von Supabase Storage laden mit Service Key
    if (pdf_urls && pdf_urls.length > 0) {
      const serviceKey = Deno.env.get("SERVICE_KEY") ?? ""
      const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? ""

      for (const url of pdf_urls) {
        try {
          // Storage-Pfad aus URL extrahieren
          // URL Format: https://xxx.supabase.co/storage/v1/object/public/dokumente/analyse/...
          const pathMatch = url.match(/\/storage\/v1\/object\/(?:public\/)?(.+)/)
          let pdfData: ArrayBuffer | null = null

          if (pathMatch && serviceKey && supabaseUrl) {
            // Mit Service Key auf privaten Storage zugreifen
            const storagePath = pathMatch[1]
            const storageRes = await fetch(
              `${supabaseUrl}/storage/v1/object/${storagePath}`,
              { headers: { "Authorization": `Bearer ${serviceKey}` } }
            )
            if (storageRes.ok) {
              pdfData = await storageRes.arrayBuffer()
            }
          }

          // Fallback: direkt von URL laden (wenn öffentlich)
          if (!pdfData) {
            const pdfRes = await fetch(url)
            if (pdfRes.ok) pdfData = await pdfRes.arrayBuffer()
          }

          if (pdfData) {
            const bytes = new Uint8Array(pdfData)
            let binary = ""
            for (let i = 0; i < bytes.length; i++) {
              binary += String.fromCharCode(bytes[i])
            }
            const pdfBase64 = btoa(binary)
            content.push({
              type: "document",
              source: {
                type: "base64",
                media_type: "application/pdf",
                data: pdfBase64,
              },
            })
          }
        } catch (e: any) {
          console.error("PDF Ladefehler:", e.message)
        }
      }
    }

    // Direkte Dokumente (Bilder, Texte)
    if (dokumente && dokumente.length > 0) {
      for (const dok of dokumente) {
        if (dok.type === "image") {
          content.push({
            type: "image",
            source: { type: "base64", media_type: dok.media_type || "image/jpeg", data: dok.data },
          })
        } else if (dok.type === "text") {
          content.push({ type: "text", text: `=== ${dok.name} ===\n${dok.data}` })
        }
      }
    }

    // Text-Prompt
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