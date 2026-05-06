import { useState, useRef } from "react";
import { ACCENT, C } from "../../lib/constants";
import * as XLSX from "xlsx";

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

// Robuste base64 Konvertierung für große Dateien
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 8192;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

async function uploadPDF(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const base64 = arrayBufferToBase64(buffer);
  const res = await fetch(`${SUPABASE_URL}/functions/v1/upload_file`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ filename: file.name, media_type: "application/pdf", data: base64 }),
  });
  if (!res.ok) throw new Error(`Upload Fehler ${res.status}`);
  const d = await res.json();
  if (d.error) throw new Error(d.error);
  return d.file_id;
}

async function bildZuBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  return arrayBufferToBase64(buffer);
}

// Excel → CSV-Text (alle Sheets werden zusammengeführt)
async function excelZuText(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  
  const teile: string[] = [];
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false });
    if (csv.trim()) {
      teile.push(`=== Tabellenblatt: ${sheetName} ===\n${csv}`);
    }
  }
  return teile.join("\n\n");
}

function dateiIcon(datei: File): string {
  if (datei.name.toLowerCase().endsWith(".pdf")) return "📄";
  if (datei.name.match(/\.(xlsx|xls|xlsm)$/i)) return "📊";
  return "🖼";
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
      const isPDF  = datei.type === "application/pdf" || datei.name.toLowerCase().endsWith(".pdf");
      const isImg  = datei.type.startsWith("image/");
      const isXLSX = datei.name.match(/\.(xlsx|xls|xlsm)$/i);
      let body: any;

      const systemPrompt = "Du bist ein Bau-Experte. Analysiere den Bauablaufplan vollständig und genau. Antworte NUR mit validem JSON Array, kein Text davor oder danach, kein Markdown.";
      const jsonPrompt = `Analysiere diesen Bauablaufplan vollständig.
Erkenne ALLE Bauphasen mit Datum und ALLE Teilaufgaben mit ihren EIGENEN Start- und Enddaten.

WICHTIG: Jede Aufgabe hat einen eigenen Zeitraum. Lies die Daten so genau wie möglich ab.

Antworte NUR mit diesem JSON Array:
[
  {
    "bauphase": "Bauphase 1",
    "datum_von": "2026-04-13",
    "datum_bis": "2026-04-20",
    "aufgaben": [
      { "titel": "Verkehrssicherung einrichten", "datum_von": "2026-04-13", "datum_bis": "2026-04-14" },
      { "titel": "Baumschutz herstellen", "datum_von": "2026-04-13", "datum_bis": "2026-04-20" }
    ]
  }
]`;

      if (isPDF) {
        setFortschritt("📤 PDF wird hochgeladen...");
        const file_id = await uploadPDF(datei);
        setFortschritt("🤖 KI analysiert Bauablaufplan...");
        body = {
          file_ids: [file_id],
          max_tokens: 4000,
          system: systemPrompt,
          prompt: `Analysiere diesen Bauablaufplan vollständig.
Erkenne ALLE Bauphasen mit Datum und ALLE Teilaufgaben mit ihren EIGENEN Start- und Enddaten.

WICHTIG: Jede Aufgabe hat im Gantt-Chart einen eigenen Balken mit eigenem Zeitraum.
Lies für jede Aufgabe den genauen Zeitraum des Balkens ab – nicht einfach das Phasendatum übernehmen!
Die Daten stehen als Spaltenüberschriften (KW oder Datum) oben im Diagramm.

${jsonPrompt}`,
        };
      } else if (isXLSX) {
        setFortschritt("📊 Excel wird gelesen...");
        const text = await excelZuText(datei);
        setFortschritt("🤖 KI analysiert Bauablaufplan...");
        body = {
          dokumente: [{ type: "text", data: text, name: datei.name }],
          max_tokens: 4000,
          system: systemPrompt,
          prompt: `Die folgende Excel-Tabelle enthält einen Bauablaufplan.
Erkenne ALLE Bauphasen und ALLE Aufgaben mit ihren Zeiträumen.
Spalten wie "Start", "Beginn", "Ende", "Fertig", "Von", "Bis" enthalten die Termine.
Zeilen mit Einrückung oder Unterpunkten sind Teilaufgaben einer Bauphase.

${jsonPrompt}`,
        };
      } else if (isImg) {
        setFortschritt("🖼 Bild wird vorbereitet...");
        const base64 = await bildZuBase64(datei);
        setFortschritt("🤖 KI analysiert Bauablaufplan...");
        body = {
          dokumente: [{ type: "image_base64", data: base64, media_type: datei.type, name: datei.name }],
          max_tokens: 4000,
          system: "Du bist ein Bau-Experte. Lies den Bauablaufplan vollständig. Antworte NUR mit validem JSON Array.",
          prompt: `Analysiere diesen Bauablaufplan.
Erkenne alle Bauphasen mit Datum und alle Aufgaben mit ihren EIGENEN Zeiträumen aus den Gantt-Balken.
${jsonPrompt}`,
        };
      } else {
        throw new Error("Bitte PDF, Excel (.xlsx) oder Bild (JPG, PNG) hochladen.");
      }

      const res = await fetch(`${SUPABASE_URL}/functions/v1/ki_chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error(`Fehler ${res.status}`);
      const d = await res.json();
      if (d.error) {
        if (d.error.includes("rate limit")) throw new Error("API Rate Limit erreicht – bitte 1 Minute warten und erneut versuchen.");
        if (d.error.includes("file")) throw new Error("Datei konnte nicht gelesen werden – bitte erneut versuchen.");
        throw new Error(d.error.slice(0, 120));
      }

      const text = d.text || "";
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) throw new Error("KI hat kein gültiges JSON zurückgegeben: " + text.slice(0, 150));

      const phasen: { bauphase: string; datum_von: string; datum_bis: string; aufgaben: any[] }[] = JSON.parse(jsonMatch[0]);

      // Aufgaben mit IDs bauen
      const aufgaben: Aufgabe[] = [];
      let id = 1;
      for (const phase of phasen) {
        for (const a of (phase.aufgaben || [])) {
          const isObj = typeof a === "object" && a !== null;
          aufgaben.push({
            id: id++,
            titel: isObj ? a.titel : a,
            erledigt: false,
            bauphase: phase.bauphase,
            datum_von: (isObj && a.datum_von) ? a.datum_von : phase.datum_von || null,
            datum_bis: (isObj && a.datum_bis) ? a.datum_bis : phase.datum_bis || null,
          });
        }
      }

      if (aufgaben.length === 0) throw new Error("Keine Aufgaben erkannt. Bitte überprüfe den Plan.");
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

      <div onClick={() => fileRef.current?.click()}
        style={{ border: "2px dashed " + (datei ? ACCENT : "#e8eaed"), borderRadius: 12, padding: "16px 20px", textAlign: "center", cursor: "pointer", background: datei ? "#f8fffe" : "#fafafa", marginBottom: 10 }}>
        {datei ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "center" }}>
            <span style={{ fontSize: 20 }}>{dateiIcon(datei)}</span>
            <div style={{ textAlign: "left" }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: ACCENT }}>{datei.name}</div>
              <div style={{ fontSize: 10, color: "#aaa" }}>{Math.round(datei.size / 1024)} KB</div>
            </div>
            <button onClick={e => { e.stopPropagation(); setDatei(null); setFehler(""); }}
              style={{ marginLeft: 8, background: "none", border: "none", color: "#E24B4A", cursor: "pointer", fontSize: 16 }}>✕</button>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: 24, marginBottom: 4 }}>📂</div>
            <div style={{ fontSize: 12, color: "#888" }}>Bauablaufplan hochladen</div>
            <div style={{ fontSize: 10, color: "#bbb", marginTop: 2 }}>PDF, Excel (.xlsx) oder Bild (JPG, PNG)</div>
          </div>
        )}
        <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.xlsx,.xls,.xlsm"
          style={{ display: "none" }} onChange={e => handleFile(e.target.files)} />
      </div>

      {fehler && (
        <div style={{ fontSize: 12, color: "#E24B4A", background: "#fff3f3", padding: "8px 12px", borderRadius: 8, marginBottom: 10 }}>
          {fehler}
        </div>
      )}

      {analyzing && (
        <div style={{ fontSize: 12, color: ACCENT, background: "#f8fffe", padding: "10px 12px", borderRadius: 8, marginBottom: 10, textAlign: "center" }}>
          <div style={{ fontSize: 20, marginBottom: 4 }}>🤖</div>
          {fortschritt}
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
