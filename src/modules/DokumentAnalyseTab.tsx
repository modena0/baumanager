import { useState, useRef } from "react";
import { C, ACCENT } from "../lib/constants";
import { supabase } from "../lib/supabase";

const SUPABASE_URL = "https://npcygxhgwqodmnqjwjnp.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wY3lneGhnd3FvZG1ucWp3am5wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0MzA5MDksImV4cCI6MjA5MjAwNjkwOX0.VCW_I_W9SVGA5DPi5R_q7leiy5t335sVucM75eYiWWY";
// Anthropic Files API Upload – gibt file_id zurück
const UPLOAD_URL = `${SUPABASE_URL}/functions/v1/upload_file`;

const BS_KAT = ["Tiefbau", "LSA", "Straße", "Sonstiges"];

interface LVPosition { nr: string; beschreibung: string; menge?: number; einheit?: string; }
interface Aufgabe {
  id: string; titel: string; beschreibung: string; bereich: string;
  lv_positionen: LVPosition[]; materialien: { name: string; menge: number; einheit: string }[];
  termine?: string; prioritaet: "hoch" | "mittel" | "niedrig"; erledigt: boolean; annahme?: string;
}
interface Bereich { name: string; beschreibung: string; aufgaben: Aufgabe[]; }
interface Vorschau {
  baustelle_name: string; ort: string; kategorie: string; beschreibung: string;
  start?: string; ende?: string; bereiche: Bereich[];
  materialien: { name: string; menge: number; einheit: string; lv_pos?: string }[];
  annahmen: string[];
}

export function DokumentAnalyseTab({ data, currentUser, rolle }: any) {
  const [dateien,     setDateien]     = useState<File[]>([]);
  const [analyzing,   setAnalyzing]   = useState(false);
  const [fortschritt, setFortschritt] = useState("");
  const [vorschau,    setVorschau]    = useState<Vorschau | null>(null);
  const [saving,      setSaving]      = useState(false);
  const [gespeichert, setGespeichert] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const kannAnalysieren = ["admin", "chef", "polier"].includes(rolle);

  function handleFiles(f: FileList | null) {
    if (!f) return;
    setDateien(prev => [...prev, ...Array.from(f)]);
  }
  function removeFile(i: number) { setDateien(prev => prev.filter((_, j) => j !== i)); }
  function getIcon(n: string) {
    if (n.endsWith(".pdf")) return "📄";
    if (n.match(/\.(jpg|jpeg|png)$/i)) return "🖼";
    if (n.match(/\.(x83|x81|gaeb)$/i)) return "📋";
    return "📁";
  }

  // PDF direkt zur Anthropic Files API hochladen via Edge Function
  async function uploadPDFToAnthropic(file: File): Promise<string> {
    // PDF als base64 zur Edge Function schicken die es zu Anthropic weiterleitet
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = "";
    for (let i = 0; i < bytes.length; i += 8192) {
      binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    }
    const base64 = btoa(binary);

    const res = await fetch(`${SUPABASE_URL}/functions/v1/upload_file`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        filename: file.name,
        media_type: "application/pdf",
        data: base64,
      }),
    });
    if (!res.ok) throw new Error(`Upload fehlgeschlagen: ${res.status}`);
    const d = await res.json();
    if (d.error) throw new Error(d.error);
    return d.file_id;
  }

  // Bild als base64
  async function bildZuBase64(file: File): Promise<{ type: string; data: string; media_type: string; name: string }> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        resolve({ type: "image_base64", data: result.split(",")[1], media_type: file.type, name: file.name });
      };
      reader.onerror = () => reject(new Error(`Fehler: ${file.name}`));
      reader.readAsDataURL(file);
    });
  }

  // Text lesen
  async function textLesen(file: File): Promise<string> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve((e.target?.result as string)?.slice(0, 8000) || "");
      reader.onerror = () => resolve("");
      reader.readAsText(file, "utf-8");
    });
  }

  async function analyseStarten() {
    if (dateien.length === 0) return;
    setAnalyzing(true);
    setVorschau(null);
    setFortschritt("📂 Dateien werden vorbereitet...");

    try {
      const file_ids: string[] = [];
      const dokumente: any[] = [];

      for (const file of dateien) {
        const isPDF = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
        const isImg = file.type.startsWith("image/");
        const isTxt = file.name.match(/\.(x83|x81|gaeb|csv|txt)$/i);

        if (isPDF) {
          setFortschritt(`📤 PDF wird zu Anthropic hochgeladen: ${file.name}...`);
          const file_id = await uploadPDFToAnthropic(file);
          file_ids.push(file_id);
        } else if (isImg) {
          setFortschritt(`🖼 Bild wird vorbereitet: ${file.name}...`);
          dokumente.push(await bildZuBase64(file));
        } else if (isTxt) {
          setFortschritt(`📋 Text wird gelesen: ${file.name}...`);
          const text = await textLesen(file);
          dokumente.push({ type: "text", data: text, name: file.name });
        }
      }

      setFortschritt("🤖 KI liest und analysiert alle Dokumente...");

      const prompt = `Du bist ein erfahrener Bauleiter und analysierst Projektunterlagen vollständig.
Lies alle beigefügten PDFs und Dokumente sorgfältig durch und erstelle eine strukturierte digitale Baustellenplanung.

ANALYSE-ANWEISUNGEN:
1. Lies alle PDFs vollständig – Baubeschreibung, Bauablaufpläne, Lagepläne, Bauphasenpläne
2. Erkenne Bauabschnitte, Bereiche, Bauphasen und deren genaue Zeiträume
3. Leite konkrete Aufgaben ab – verständlich für Vorarbeiter
4. Erkenne Termine, Kalenderwochen aus dem Bauablaufplan
5. Erkenne Materialien mit Mengen und Einheiten
6. Wenn Informationen fehlen, mache sinnvolle Annahmen [ANNAHME]

Antworte NUR mit validem JSON, kein Markdown:
{
  "baustelle_name": "Name",
  "ort": "Ort/Adresse",
  "kategorie": "Tiefbau|LSA|Straße|Sonstiges",
  "beschreibung": "Kurze Projektbeschreibung",
  "start": "YYYY-MM-DD oder null",
  "ende": "YYYY-MM-DD oder null",
  "bereiche": [
    {
      "name": "z.B. Bauphase 1 oder Baufeld Mittelinsel",
      "beschreibung": "Was wird gemacht und wann",
      "aufgaben": [
        {
          "id": "A001",
          "titel": "Aufgabentitel",
          "beschreibung": "Detaillierte Beschreibung für Vorarbeiter",
          "bereich": "Bereichsname",
          "prioritaet": "hoch|mittel|niedrig",
          "erledigt": false,
          "lv_positionen": [],
          "materialien": [],
          "termine": "z.B. KW 16-17 oder 13.04.-20.04.2026",
          "annahme": null
        }
      ]
    }
  ],
  "materialien": [],
  "annahmen": []
}`;

      const body: any = { prompt, system: "Du bist ein erfahrener Bauleiter. Antworte NUR mit validem JSON.", max_tokens: 4000 };
      if (file_ids.length > 0) body.file_ids = file_ids;
      if (dokumente.length > 0) body.dokumente = dokumente;

      const res = await fetch(`${SUPABASE_URL}/functions/v1/ki_chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SUPABASE_ANON_KEY}` },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error(`Edge Function Fehler ${res.status}`);
      const d = await res.json();
      if (d.error) throw new Error(d.error);
      if (!d.text) throw new Error("Keine Antwort");

      setFortschritt("🔍 Struktur wird aufbereitet...");
      const jsonMatch = d.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("Kein JSON: " + d.text.slice(0, 100));

      const result: Vorschau = JSON.parse(jsonMatch[0]);
      result.bereiche = (result.bereiche || []).map((b, bi) => ({
        ...b,
        aufgaben: (b.aufgaben || []).map((a, ai) => ({ ...a, id: a.id || `A${bi + 1}${String(ai + 1).padStart(2, "0")}` })),
      }));

      setVorschau(result);
      setFortschritt("");
    } catch (e: any) {
      setFortschritt("❌ Fehler: " + e.message);
    }
    setAnalyzing(false);
  }

  async function baustelleUebernehmen() {
    if (!vorschau) return;
    setSaving(true);
    const alleAufgaben = vorschau.bereiche.flatMap(b =>
      b.aufgaben.map((a, i) => ({ id: i + 1, titel: a.titel, erledigt: false }))
    );
    const { data: neu } = await supabase.from("baustellen").insert([{
      name: vorschau.baustelle_name, ort: vorschau.ort, kategorie: vorschau.kategorie,
      beschreibung: vorschau.beschreibung, status: "geplant",
      start: vorschau.start || null, ende: vorschau.ende || null,
      mitarbeiter: [], fahrzeuge: [], equipment: [], aufgaben: alleAufgaben, anforderungen: [],
    }]).select();
    if (neu) {
      await supabase.from("dokument_analyse").insert([{
        baustelle_name: vorschau.baustelle_name, status: "uebernommen",
        struktur: vorschau, erstellt_von: currentUser?.name || "",
      }]);
      setGespeichert(true);
      setTimeout(() => { setGespeichert(false); setVorschau(null); setDateien([]); }, 3000);
    }
    setSaving(false);
  }

  function updateAufgabe(bIdx: number, aIdx: number, updates: Partial<Aufgabe>) {
    setVorschau(v => {
      if (!v) return v;
      const nb = [...v.bereiche];
      nb[bIdx] = { ...nb[bIdx], aufgaben: nb[bIdx].aufgaben.map((a, i) => i === aIdx ? { ...a, ...updates } : a) };
      return { ...v, bereiche: nb };
    });
  }
  function addAufgabe(bIdx: number) {
    setVorschau(v => {
      if (!v) return v;
      const nb = [...v.bereiche];
      nb[bIdx] = { ...nb[bIdx], aufgaben: [...nb[bIdx].aufgaben, { id: "NEU_" + Date.now(), titel: "Neue Aufgabe", beschreibung: "", bereich: nb[bIdx].name, lv_positionen: [], materialien: [], prioritaet: "mittel", erledigt: false }] };
      return { ...v, bereiche: nb };
    });
  }
  function removeAufgabe(bIdx: number, aIdx: number) {
    setVorschau(v => {
      if (!v) return v;
      const nb = [...v.bereiche];
      nb[bIdx] = { ...nb[bIdx], aufgaben: nb[bIdx].aufgaben.filter((_, i) => i !== aIdx) };
      return { ...v, bereiche: nb };
    });
  }
  function addBereich() {
    setVorschau(v => v ? { ...v, bereiche: [...v.bereiche, { name: "Neuer Bereich", beschreibung: "", aufgaben: [] }] } : v);
  }

  const pFarbe = (p: string) => p === "hoch" ? "#E24B4A" : p === "mittel" ? "#BA7517" : "#888";

  if (!vorschau) return (
    <div>
      <div style={{ fontSize: 15, fontWeight: 700, color: "#222", marginBottom: 4 }}>🤖 Baustellenstruktur aus Dokumenten</div>
      <div style={{ fontSize: 12, color: "#aaa", marginBottom: 20 }}>PDFs werden zur Anthropic Files API hochgeladen und vollständig analysiert</div>
      {!kannAnalysieren ? (
        <div style={{ ...C.card, textAlign: "center", color: "#bbb", padding: 32 }}>Kein Zugriff</div>
      ) : (
        <>
          <div ref={dropRef}
            onDragOver={e => { e.preventDefault(); if (dropRef.current) dropRef.current.style.borderColor = ACCENT; }}
            onDragLeave={() => { if (dropRef.current) dropRef.current.style.borderColor = "#e8eaed"; }}
            onDrop={e => { e.preventDefault(); handleFiles(e.dataTransfer.files); if (dropRef.current) dropRef.current.style.borderColor = "#e8eaed"; }}
            onClick={() => fileRef.current?.click()}
            style={{ border: "2px dashed #e8eaed", borderRadius: 16, padding: 40, textAlign: "center", cursor: "pointer", marginBottom: 16, background: "#fafafa" }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>📂</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#333", marginBottom: 4 }}>Dokumente hier ablegen</div>
            <div style={{ fontSize: 12, color: "#aaa", marginBottom: 4 }}>PDF, GAEB (.x83, .x81), Bilder</div>
            <div style={{ fontSize: 11, color: ACCENT }}>✦ PDFs werden vollständig gelesen – alle Seiten, Pläne, Bauablauf</div>
            <input ref={fileRef} type="file" multiple accept=".pdf,.x83,.x81,.gaeb,.csv,.txt,.jpg,.jpeg,.png"
              style={{ display: "none" }} onChange={e => handleFiles(e.target.files)} />
          </div>

          {dateien.length > 0 && (
            <div style={{ ...C.card, marginBottom: 16, padding: "14px 16px" }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#222", marginBottom: 10 }}>{dateien.length} Datei{dateien.length !== 1 ? "en" : ""}</div>
              {dateien.map((f, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", borderBottom: "1px solid #f5f5f5" }}>
                  <span style={{ fontSize: 18 }}>{getIcon(f.name)}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{f.name}</div>
                    <div style={{ fontSize: 11, color: "#aaa" }}>
                      {Math.round(f.size / 1024)} KB
                      {(f.type === "application/pdf" || f.name.endsWith(".pdf")) && <span style={{ color: ACCENT, marginLeft: 6 }}>✦ wird vollständig gelesen</span>}
                    </div>
                  </div>
                  <button onClick={() => removeFile(i)} style={{ background: "none", border: "none", cursor: "pointer", color: "#E24B4A", fontSize: 16 }}>✕</button>
                </div>
              ))}
            </div>
          )}

          {dateien.length > 0 && !analyzing && (
            <button onClick={analyseStarten} style={{ ...C.btnP, width: "100%", padding: "14px", fontSize: 14 }}>
              ✦ KI-Analyse starten
            </button>
          )}

          {analyzing && (
            <div style={{ ...C.card, marginTop: 16, textAlign: "center", padding: 24, background: "#f8fffe", border: "1px solid " + ACCENT + "44" }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>🤖</div>
              <div style={{ fontSize: 13, color: ACCENT, fontWeight: 500 }}>{fortschritt}</div>
              <div style={{ fontSize: 11, color: "#aaa", marginTop: 6 }}>Kann 30-60 Sekunden dauern...</div>
            </div>
          )}

          {fortschritt.startsWith("❌") && !analyzing && (
            <div style={{ ...C.card, marginTop: 16, padding: "12px 16px", background: "#fff3f3", border: "1px solid #E24B4A33" }}>
              <div style={{ fontSize: 13, color: "#E24B4A" }}>{fortschritt}</div>
            </div>
          )}

          <div style={{ ...C.card, marginTop: 16, padding: "12px 14px", background: "#f8f8ff" }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#555", marginBottom: 6 }}>💡 Tipps</div>
            <div style={{ fontSize: 11, color: "#777", lineHeight: 1.7 }}>
              • <strong>PDF-Baubeschreibung</strong> – wird vollständig gelesen, alle Seiten inkl. Pläne<br/>
              • <strong>Bauablaufplan als PDF</strong> – Termine und Bauphasen werden erkannt<br/>
              • <strong>LV als GAEB (.x83)</strong> – Positionen werden Aufgaben zugewiesen
            </div>
          </div>
        </>
      )}
    </div>
  );

  return (
    <div>
      <div style={{ ...C.card, marginBottom: 16, padding: 16, background: "#f8fffe", border: "1px solid " + ACCENT + "44" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: ACCENT, fontWeight: 600, marginBottom: 4 }}>✦ KI-VORSCHAU – Bitte prüfen</div>
            <input value={vorschau.baustelle_name} onChange={e => setVorschau(v => v ? { ...v, baustelle_name: e.target.value } : v)}
              style={{ fontSize: 18, fontWeight: 700, color: "#222", border: "none", borderBottom: "2px solid " + ACCENT + "44", background: "transparent", outline: "none", width: "100%", marginBottom: 4 }} />
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <input value={vorschau.ort} onChange={e => setVorschau(v => v ? { ...v, ort: e.target.value } : v)}
                style={{ fontSize: 12, color: "#888", border: "none", borderBottom: "1px solid #eee", background: "transparent", outline: "none" }} placeholder="Ort" />
              <select value={vorschau.kategorie} onChange={e => setVorschau(v => v ? { ...v, kategorie: e.target.value } : v)}
                style={{ fontSize: 12, color: "#888", border: "none", background: "transparent", outline: "none" }}>
                {BS_KAT.map(k => <option key={k} value={k}>{k}</option>)}
              </select>
              <input type="date" value={vorschau.start || ""} onChange={e => setVorschau(v => v ? { ...v, start: e.target.value } : v)}
                style={{ fontSize: 12, color: "#888", border: "none", background: "transparent", outline: "none" }} />
              <span style={{ fontSize: 12, color: "#aaa" }}>–</span>
              <input type="date" value={vorschau.ende || ""} onChange={e => setVorschau(v => v ? { ...v, ende: e.target.value } : v)}
                style={{ fontSize: 12, color: "#888", border: "none", background: "transparent", outline: "none" }} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setVorschau(null)} style={{ ...C.btnS, fontSize: 12 }}>← Neu</button>
            <button onClick={baustelleUebernehmen} disabled={saving || gespeichert}
              style={{ ...C.btnP, fontSize: 12, background: gespeichert ? "#1D9E75" : ACCENT, minWidth: 120 }}>
              {gespeichert ? "✓ Übernommen!" : saving ? "Speichert..." : "✓ Übernehmen"}
            </button>
          </div>
        </div>
        <textarea value={vorschau.beschreibung} onChange={e => setVorschau(v => v ? { ...v, beschreibung: e.target.value } : v)}
          style={{ ...C.inp, marginTop: 10, marginBottom: 0, fontSize: 12, resize: "vertical" as any }} rows={2} />
      </div>

      {vorschau.annahmen?.length > 0 && (
        <div style={{ ...C.card, marginBottom: 16, padding: "12px 14px", background: "#fff8e1", border: "1px solid #BA751733" }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#BA7517", marginBottom: 6 }}>⚠ KI-Annahmen:</div>
          {vorschau.annahmen.map((a, i) => <div key={i} style={{ fontSize: 11, color: "#666", marginBottom: 2 }}>• {a}</div>)}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
        {[["Bereiche", vorschau.bereiche.length, "🏗"], ["Aufgaben", vorschau.bereiche.reduce((s, b) => s + b.aufgaben.length, 0), "✓"], ["Materialien", vorschau.materialien?.length || 0, "📦"]].map(([l, v, i]) => (
          <div key={l as string} style={{ ...C.card, textAlign: "center", padding: "12px 8px" }}>
            <div style={{ fontSize: 20 }}>{i}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: ACCENT }}>{v}</div>
            <div style={{ fontSize: 11, color: "#aaa" }}>{l}</div>
          </div>
        ))}
      </div>

      {vorschau.bereiche.map((bereich, bIdx) => (
        <div key={bIdx} style={{ ...C.card, marginBottom: 14, padding: "14px 16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ flex: 1 }}>
              <input value={bereich.name} onChange={e => setVorschau(v => { if (!v) return v; const nb = [...v.bereiche]; nb[bIdx] = { ...nb[bIdx], name: e.target.value }; return { ...v, bereiche: nb }; })}
                style={{ fontSize: 14, fontWeight: 700, color: "#222", border: "none", borderBottom: "1px solid #eee", background: "transparent", outline: "none", width: "100%" }} />
              <input value={bereich.beschreibung} onChange={e => setVorschau(v => { if (!v) return v; const nb = [...v.bereiche]; nb[bIdx] = { ...nb[bIdx], beschreibung: e.target.value }; return { ...v, bereiche: nb }; })}
                style={{ fontSize: 12, color: "#888", border: "none", background: "transparent", outline: "none", width: "100%", marginTop: 2 }} placeholder="Beschreibung..." />
            </div>
            <span style={{ fontSize: 11, color: "#bbb", background: "#f5f5f5", padding: "2px 8px", borderRadius: 10, marginLeft: 10 }}>{bereich.aufgaben.length} Aufgaben</span>
          </div>

          {bereich.aufgaben.map((a, aIdx) => (
            <div key={a.id} style={{ background: "#f8fffe", borderRadius: 10, border: "1px solid #e8f5f3", padding: "12px 14px", marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", gap: 6, marginBottom: 4, flexWrap: "wrap" }}>
                    <select value={a.prioritaet} onChange={e => updateAufgabe(bIdx, aIdx, { prioritaet: e.target.value as any })}
                      style={{ fontSize: 10, padding: "1px 6px", borderRadius: 6, border: "1px solid " + pFarbe(a.prioritaet), color: pFarbe(a.prioritaet), background: pFarbe(a.prioritaet) + "18", cursor: "pointer", outline: "none" }}>
                      <option value="hoch">● Hoch</option><option value="mittel">● Mittel</option><option value="niedrig">● Niedrig</option>
                    </select>
                    {a.termine && <span style={{ fontSize: 10, color: "#7986CB", background: "#7986CB18", padding: "1px 6px", borderRadius: 6 }}>📅 {a.termine}</span>}
                    {a.annahme && <span style={{ fontSize: 10, color: "#BA7517", background: "#BA751718", padding: "1px 6px", borderRadius: 6 }}>⚠ Annahme</span>}
                  </div>
                  <input value={a.titel} onChange={e => updateAufgabe(bIdx, aIdx, { titel: e.target.value })}
                    style={{ fontSize: 13, fontWeight: 600, color: "#222", border: "none", borderBottom: "1px solid #eee", background: "transparent", outline: "none", width: "100%", marginBottom: 4 }} />
                  <textarea value={a.beschreibung} onChange={e => updateAufgabe(bIdx, aIdx, { beschreibung: e.target.value })}
                    style={{ fontSize: 12, color: "#555", border: "none", background: "transparent", outline: "none", width: "100%", resize: "vertical" as any, lineHeight: 1.5, fontFamily: "system-ui" }} rows={2} />
                </div>
                <button onClick={() => removeAufgabe(bIdx, aIdx)} style={{ background: "none", border: "none", cursor: "pointer", color: "#E24B4A", fontSize: 14, flexShrink: 0 }}>✕</button>
              </div>
              {a.lv_positionen?.length > 0 && (
                <div style={{ marginTop: 8, padding: "8px 10px", background: "#fff", borderRadius: 8, border: "1px solid #eee" }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: "#aaa", marginBottom: 4 }}>LV-POSITIONEN</div>
                  {a.lv_positionen.map((lv, li) => (
                    <div key={li} style={{ fontSize: 11, color: "#555", display: "flex", gap: 8 }}>
                      <span style={{ color: ACCENT, fontWeight: 600, minWidth: 40 }}>{lv.nr}</span>
                      <span style={{ flex: 1 }}>{lv.beschreibung}</span>
                      {lv.menge && <span style={{ color: "#888" }}>{lv.menge} {lv.einheit}</span>}
                    </div>
                  ))}
                </div>
              )}
              {a.materialien?.length > 0 && (
                <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {a.materialien.map((m, mi) => (
                    <span key={mi} style={{ fontSize: 10, padding: "2px 7px", borderRadius: 6, background: "#f0f4f3", color: "#555" }}>📦 {m.name} {m.menge} {m.einheit}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
          <button onClick={() => addAufgabe(bIdx)} style={{ ...C.btnS, fontSize: 12, width: "100%", marginTop: 4 }}>+ Aufgabe</button>
        </div>
      ))}

      <button onClick={addBereich} style={{ ...C.btnS, width: "100%", marginBottom: 16 }}>+ Bereich</button>

      {vorschau.materialien?.length > 0 && (
        <div style={{ ...C.card, marginBottom: 16, padding: "14px 16px" }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#222", marginBottom: 10 }}>📦 Materialübersicht</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 8 }}>
            {vorschau.materialien.map((m, i) => (
              <div key={i} style={{ padding: "8px 12px", background: "#f8fffe", borderRadius: 8, border: "1px solid #e8f5f3" }}>
                <div style={{ fontSize: 12, fontWeight: 600 }}>{m.name}</div>
                <div style={{ fontSize: 11, color: ACCENT }}>{m.menge} {m.einheit}</div>
                {m.lv_pos && <div style={{ fontSize: 10, color: "#aaa" }}>LV: {m.lv_pos}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      <button onClick={baustelleUebernehmen} disabled={saving || gespeichert}
        style={{ ...C.btnP, width: "100%", padding: "14px", fontSize: 14, background: gespeichert ? "#1D9E75" : ACCENT }}>
        {gespeichert ? "✓ Erfolgreich übernommen!" : saving ? "Speichert..." : "✓ Baustelle übernehmen"}
      </button>
    </div>
  );
}
