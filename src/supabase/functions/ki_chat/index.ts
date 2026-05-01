import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
}

// Korrekte base64 Konvertierung für große Dateien in Deno
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  const chunkSize = 8192
  let binary = ""
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize)
    binary += String.fromCharCode(...chunk)
  }
  return btoa(binary)
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors })

  try {
    const { prompt, system, max_tokens, pdf_urls, dokumente } = await req.json()

    const content: any[] = []

    // PDFs von öffentlicher URL laden
    if (pdf_urls && pdf_urls.length > 0) {
      for (const url of pdf_urls) {
        try {
          console.log("Lade PDF von:", url)
          const pdfRes = await fetch(url)
          if (!pdfRes.ok) {
            console.error("PDF laden fehlgeschlagen:", pdfRes.status, url)
            continue
          }
          const pdfBuffer = await pdfRes.arrayBuffer()
          console.log("PDF geladen, Größe:", pdfBuffer.byteLength, "bytes")
          const pdfBase64 = arrayBufferToBase64(pdfBuffer)
          console.log("Base64 Länge:", pdfBase64.length)
          content.push({
            type: "document",
            source: {
              type: "base64",
              media_type: "application/pdf",
              data: pdfBase64,
            },
          })
        } catch (e: any) {
          console.error("PDF Fehler:", e.message)
        }
      }
    }

    // Bilder und Texte
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

    content.push({ type: "text", text: prompt })

    console.log("Content blocks:", content.length, "- davon PDFs:", content.filter(c => c.type === "document").length)

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
    console.log("Anthropic response type:", d.type, "- error:", d.error?.message)

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
    console.error("Fehler:", e.message)
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
    )
  }
})