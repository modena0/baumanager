import { useState, useRef } from "react";
import { ACCENT, C } from "../../lib/constants";

const SUPABASE_URL = "https://npcygxhgwqodmnqjwjnp.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wY3lneGhnd3FvZG1ucWp3am5wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0MzA5MDksImV4cCI6MjA5MjAwNjkwOX0.VCW_I_W9SVGA5DPi5R_q7leiy5t335sVucM75eYiWWY";

interface Aufgabe {
  id: number;
  titel: string;
  erledigt: boolean;
  bauphase: string | null;
  datum_von: string | null;
  datum_bis: string | null;
}

interface Props {
  onAufgaben: (aufgaben: Aufgabe[]) => void;
  onSkip: () => void;
}

async function uploadPDF(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 8192) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  }
  const base64 = btoa(binary);
  const res = await fetch(`${SUPABASE_URL}/functions/v1/upload_file`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SUPABASE_ANON_KEY}` },
    body: JSON.stringify({ filename: file.name, media_type: file.type || "application/pdf", data: base64 }),
  });
  const d = await res.json();
  if (d.error) throw new Error(d.error);
  return d.file_id;
}

async function bildZuBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve((e.target?.result as string).split(",")[1]);
    reader.onerror = () => reject(new Error("Lesefehler"));
    reader.readAsDataURL(file);
  });
}

export function BauablaufAnalyse({ onAufgaben, onSkip }: Props) {
  const [datei,       setDatei]       = useState<File | null>(null);
  const [analyzing,   setAnalyzing]   = useState(false);
  const [fortschritt, setFortschritt] = useState("");
  const [fehler,      setFehler]      = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFile(f: FileList | null) {
    if (!f || !f[0]) return;
    setDatei(f[0]);
    setFehler("");
  }

  async function analysieren() {
    if (!datei) return;
    setAnalyzing(true);
    setFehler("");

    try {
      const isPDF = datei.type === "application/pdf" || datei.name.toLowerCase().endsWith(".pdf");
      const isImg = datei.type.startsWith("image/");

      let body: any;

      if (isPDF) {
        setFortschritt("📤 PDF wird hochgeladen...");
        const file_id = await uploadPDF(datei);
        setFortschritt("🤖 KI analysiert Bauablaufplan...");
        body = { file_ids: [file_id], max_tokens: 3000 };
      } else if (isImg) {
        setFortschritt("🖼 Bild wird vorbereitet...");
        const base64 = await bildZuBase64(datei);
        setFortschritt("🤖 KI analysiert Bauablaufplan...");
        body = {
          dokumente: [{ type: "image_base64", data: base64, media_type: datei.type, name: datei.name }],
          max_tokens: 3000,
        };
      } else {
        throw new Error("Bitte PDF, Excel oder Bild hochladen.");
      }

      body.prompt = `Analysiere diesen Bauablaufplan vollständig.
Erkenne alle Bauphasen mit ihren genauen Start- und Enddaten sowie alle Teilaufgaben.

Antworte NUR mit validem JSON, kein Markdown:
[
  {
    "bauphase": "Bauphase 1",
    "datum_von": "2026-04-13",
    "datum_bis": "2026-04-20",
    "aufgaben": [
      "Verkehrssicherung einrichten",
      "Baumschutz herstellen",
      "Kampfmittelerkundung"
    ]
  }
]`;
      body.system = "Du bist ein Bau-Experte. Lies den Bauablaufplan vollständig. Antworte NUR mit validem JSON Array, kein Text davor oder danach.";

      const res = await fetch(`${SUPABASE_URL}/functions/v1/ki_chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SUPABASE_ANON_KEY}` },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`Fehler ${res.status}`);
      const d = await res.json();
      if (d.error) throw new Error(d.error);

      const jsonMatch = d.text?.match(/\[[\s\S]*\]/);
      if (!jsonMatch) throw new Error("KI hat kein gültiges JSON zurückgegeben");

      const phasen: { bauphase: string; datum_von: string; datum_bis: string; aufgaben: string[] }[] = JSON.parse(jsonMatch[0]);

      // Aufgaben mit IDs und Bauphase-Info aufbauen
      const aufgaben: Aufgabe[] = [];
      let id = 1;
      for (const phase of phasen) {
        for (const titel of phase.aufgaben) {
          aufgaben.push({
            id: id++,
            titel,
            erledigt: false,
            bauphase: phase.bauphase,
            datum_von: phase.datum_von || null,
            datum_bis: phase.datum_bis || null,
          });
        }
      }

      onAufgaben(aufgaben);
    } catch (e: any) {
      setFehler("❌ " + e.message);
    }
    setAnalyzing(false);
    setFortschritt("");
  }

  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 600, color: "#222", marginBottom: 4 }}>
        📋 Bauablaufplan hochladen (optional)
      </div>
      <div style={{ fontSize: 11, color: "#aaa", marginBottom: 12 }}>
        KI liest den Plan und erstellt automatisch Bauphasen mit Terminen
      </div>

      {/* Upload Bereich */}
      <div onClick={() => fileRef.current?.click()}
        style={{ border: "2px dashed " + (datei ? ACCENT : "#e8eaed"), borderRadius: 12, padding: "16px 20px", textAlign: "center", cursor: "pointer", background: datei ? "#f8fffe" : "#fafafa", marginBottom: 10, transition: "all 0.2s" }}>
        {datei ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "center" }}>
            <span style={{ fontSize: 20 }}>{datei.name.endsWith(".pdf") ? "📄" : "🖼"}</span>
            <div style={{ textAlign: "left" }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: ACCENT }}>{datei.name}</div>
              <div style={{ fontSize: 10, color: "#aaa" }}>{Math.round(datei.size / 1024)} KB</div>
            </div>
            <button onClick={e => { e.stopPropagation(); setDatei(null); }}
              style={{ marginLeft: 8, background: "none", border: "none", color: "#E24B4A", cursor: "pointer", fontSize: 16 }}>✕</button>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: 24, marginBottom: 4 }}>📂</div>
            <div style={{ fontSize: 12, color: "#888" }}>Bauablaufplan hochladen</div>
            <div style={{ fontSize: 10, color: "#bbb", marginTop: 2 }}>PDF, Bild (JPG, PNG)</div>
          </div>
        )}
        <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.xlsx,.xls"
          style={{ display: "none" }} onChange={e => handleFile(e.target.files)} />
      </div>

      {fehler && (
        <div style={{ fontSize: 12, color: "#E24B4A", background: "#fff3f3", padding: "8px 12px", borderRadius: 8, marginBottom: 10 }}>
          {fehler}
        </div>
      )}

      {analyzing && (
        <div style={{ fontSize: 12, color: ACCENT, background: "#f8fffe", padding: "8px 12px", borderRadius: 8, marginBottom: 10, textAlign: "center" }}>
          {fortschritt || "Analysiert..."}
        </div>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        {datei && !analyzing && (
          <button onClick={analysieren}
            style={{ flex: 1, padding: "9px", borderRadius: 10, border: "none", background: ACCENT, color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
            ✦ Bauphasen erkennen
          </button>
        )}
        <button onClick={onSkip}
          style={{ flex: datei ? "0 0 auto" : 1, padding: "9px 14px", borderRadius: 10, border: "1.5px solid #eee", background: "#fff", cursor: "pointer", fontSize: 12, color: "#888" }}>
          {datei ? "Überspringen" : "Ohne Bauablaufplan fortfahren"}
        </button>
      </div>
    </div>
  );
}
