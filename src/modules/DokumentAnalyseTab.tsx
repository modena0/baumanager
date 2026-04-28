import { useState, useRef } from "react";
import { C, ACCENT } from "../lib/constants";
import { supabase } from "../lib/supabase";

const BS_KAT  = ["Tiefbau", "LSA", "Straße", "Sonstiges"];
const EINHEITEN = ["m³", "m²", "m", "t", "kg", "Stück", "l", "Palette"];

interface LVPosition {
  nr: string;
  beschreibung: string;
  menge?: number;
  einheit?: string;
  einheitspreis?: number;
  aufgabe?: string;
}

interface Aufgabe {
  id: string;
  titel: string;
  beschreibung: string;
  bereich: string;
  lv_positionen: LVPosition[];
  materialien: { name: string; menge: number; einheit: string }[];
  termine?: string;
  prioritaet: "hoch" | "mittel" | "niedrig";
  erledigt: boolean;
  annahme?: string;
}

interface Bereich {
  name: string;
  beschreibung: string;
  aufgaben: Aufgabe[];
}

interface Vorschau {
  baustelle_name: string;
  ort: string;
  kategorie: string;
  beschreibung: string;
  start?: string;
  ende?: string;
  bereiche: Bereich[];
  materialien: { name: string; menge: number; einheit: string; lv_pos?: string }[];
  annahmen: string[];
}

export function DokumentAnalyseTab({ data, currentUser, rolle }: any) {
  const [dateien,    setDateien]    = useState<File[]>([]);
  const [analyzing,  setAnalyzing]  = useState(false);
  const [fortschritt,setFortschritt]= useState("");
  const [vorschau,   setVorschau]   = useState<Vorschau|null>(null);
  const [editBereich,setEditBereich]= useState<number|null>(null);
  const [editAufgabe,setEditAufgabe]= useState<{b:number,a:number}|null>(null);
  const [saving,     setSaving]     = useState(false);
  const [gespeichert,setGespeichert]= useState(false);
  const dropRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const kannAnalysieren = ["admin", "chef", "polier"].includes(rolle);

  // ── Datei-Upload ──────────────────────────────────────────────────────────────
  function handleFiles(files: FileList | null) {
    if (!files) return;
    setDateien(prev => [...prev, ...Array.from(files)]);
  }

  function removeFile(idx: number) {
    setDateien(prev => prev.filter((_, i) => i !== idx));
  }

  function getFileIcon(name: string) {
    if (name.endsWith(".pdf")) return "📄";
    if (name.endsWith(".xlsx") || name.endsWith(".xls")) return "📊";
    if (name.endsWith(".x83") || name.endsWith(".x81") || name.endsWith(".gaeb")) return "📋";
    if (name.endsWith(".docx") || name.endsWith(".doc")) return "📝";
    return "📁";
  }

  // ── Datei zu Text konvertieren ────────────────────────────────────────────────
  async function dateiZuText(file: File): Promise<string> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result;
        if (typeof result === "string") {
          // Für Text-basierte Dateien (GAEB, CSV)
          resolve(result.slice(0, 8000)); // Max 8000 Zeichen pro Datei
        } else {
          resolve(`[Binärdatei: ${file.name} - ${Math.round(file.size / 1024)} KB]`);
        }
      };
      reader.onerror = () => resolve(`[Fehler beim Lesen: ${file.name}]`);

      // Text-Dateien als Text lesen
      if (file.name.endsWith(".x83") || file.name.endsWith(".x81") ||
          file.name.endsWith(".gaeb") || file.name.endsWith(".csv") ||
          file.name.endsWith(".txt")) {
        reader.readAsText(file, "utf-8");
      } else {
        // Für PDF/Excel: Dateiname + Größe als Hinweis
        resolve(`[Dokument: ${file.name}, Größe: ${Math.round(file.size / 1024)} KB, Typ: ${file.type || "unbekannt"}]`);
      }
    });
  }

  // ── KI Analyse ───────────────────────────────────────────────────────────────
  async function analyseStarten() {
    if (dateien.length === 0) return;
    setAnalyzing(true);
    setVorschau(null);

    try {
      // Dateien zu Text konvertieren
      setFortschritt("📂 Dateien werden eingelesen...");
      const dateiTexte = await Promise.all(dateien.map(async (f) => {
        const text = await dateiZuText(f);
        return `=== ${f.name} ===\n${text}`;
      }));

      setFortschritt("🤖 KI analysiert Projektunterlagen...");

      const prompt = `Du bist ein erfahrener Bauleiter und analysierst Projektunterlagen für eine Baustelle.
Analysiere die folgenden Dokumente und erstelle eine strukturierte digitale Baustellenplanung.

DOKUMENTE:
${dateiTexte.join("\n\n")}

WICHTIGE REGELN:
1. Erkenne Bauabschnitte, Bereiche, FGUs, Schächte aus den Dokumenten
2. Leite konkrete Aufgaben ab - verständlich für Vorarbeiter
3. Weise LV-Positionen den passenden Aufgaben zu
4. Erkenne Materialien mit Mengen und Einheiten
5. Erkenne Termine wenn vorhanden
6. Wenn Informationen fehlen, mache sinnvolle Annahmen und kennzeichne sie mit [ANNAHME]
7. Denke wie ein erfahrener Bauleiter - erkenne Zusammenhänge
8. Priorisiere praktische Nutzbarkeit

Antworte NUR mit einem validen JSON Objekt. Kein Text davor oder danach:

{
  "baustelle_name": "Name der Baustelle",
  "ort": "Ort/Adresse",
  "kategorie": "Tiefbau|LSA|Straße|Sonstiges",
  "beschreibung": "Kurze Projektbeschreibung",
  "start": "YYYY-MM-DD oder null",
  "ende": "YYYY-MM-DD oder null",
  "bereiche": [
    {
      "name": "Bereichsname (z.B. Bauabschnitt 1, FGU Nord)",
      "beschreibung": "Was wird hier gemacht",
      "aufgaben": [
        {
          "id": "A001",
          "titel": "Kurzer Aufgabentitel",
          "beschreibung": "Detaillierte Beschreibung für Vorarbeiter",
          "bereich": "Bereichsname",
          "prioritaet": "hoch|mittel|niedrig",
          "erledigt": false,
          "lv_positionen": [
            {
              "nr": "1.1.1",
              "beschreibung": "LV-Positionsbeschreibung",
              "menge": 100,
              "einheit": "m",
              "einheitspreis": 0
            }
          ],
          "materialien": [
            { "name": "Materialname", "menge": 100, "einheit": "m" }
          ],
          "termine": "z.B. KW 15-18 oder null",
          "annahme": "Beschreibung der Annahme wenn nötig, sonst null"
        }
      ]
    }
  ],
  "materialien": [
    { "name": "Material", "menge": 100, "einheit": "m", "lv_pos": "1.1.1" }
  ],
  "annahmen": ["Liste aller gemachten Annahmen"]
}`;

      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 4000,
          messages: [{ role: "user", content: prompt }],
        }),
      });

      const d = await res.json();
      const text = d.content?.[0]?.text;
      if (!text) throw new Error("Keine Antwort von KI");

      setFortschritt("🔍 Struktur wird aufbereitet...");

      // JSON extrahieren
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("KI hat kein gültiges JSON zurückgegeben");

      const result: Vorschau = JSON.parse(jsonMatch[0]);

      // IDs sicherstellen
      result.bereiche = result.bereiche.map((b, bi) => ({
        ...b,
        aufgaben: b.aufgaben.map((a, ai) => ({
          ...a,
          id: a.id || `A${bi + 1}${ai + 1}`,
        })),
      }));

      setVorschau(result);
      setFortschritt("");

    } catch (e: any) {
      setFortschritt("❌ Fehler: " + e.message);
    }
    setAnalyzing(false);
  }

  // ── Baustelle übernehmen ──────────────────────────────────────────────────────
  async function baustelleUebernehmen() {
    if (!vorschau) return;
    setSaving(true);

    // Alle Aufgaben aus allen Bereichen sammeln
    const alleAufgaben = vorschau.bereiche.flatMap(b =>
      b.aufgaben.map((a, idx) => ({
        id: idx + 1,
        titel: a.titel,
        erledigt: false,
      }))
    );

    // Baustelle in Supabase speichern
    const { data: neu } = await supabase.from("baustellen").insert([{
      name: vorschau.baustelle_name,
      ort: vorschau.ort,
      kategorie: vorschau.kategorie,
      beschreibung: vorschau.beschreibung,
      status: "geplant",
      start: vorschau.start || null,
      ende: vorschau.ende || null,
      mitarbeiter: [],
      fahrzeuge: [],
      equipment: [],
      aufgaben: alleAufgaben,
      anforderungen: [],
    }]).select();

    if (neu) {
      // Analyse in Supabase speichern
      await supabase.from("dokument_analyse").insert([{
        baustelle_name: vorschau.baustelle_name,
        status: "uebernommen",
        struktur: vorschau,
        erstellt_von: currentUser?.name || "",
      }]);

      setGespeichert(true);
      setTimeout(() => {
        setGespeichert(false);
        setVorschau(null);
        setDateien([]);
      }, 3000);
    }
    setSaving(false);
  }

  // ── Vorschau bearbeiten ───────────────────────────────────────────────────────
  function updateAufgabe(bIdx: number, aIdx: number, updates: Partial<Aufgabe>) {
    setVorschau(v => {
      if (!v) return v;
      const nb = [...v.bereiche];
      nb[bIdx] = {
        ...nb[bIdx],
        aufgaben: nb[bIdx].aufgaben.map((a, i) => i === aIdx ? { ...a, ...updates } : a),
      };
      return { ...v, bereiche: nb };
    });
  }

  function addAufgabe(bIdx: number) {
    setVorschau(v => {
      if (!v) return v;
      const nb = [...v.bereiche];
      nb[bIdx] = {
        ...nb[bIdx],
        aufgaben: [...nb[bIdx].aufgaben, {
          id: "NEU_" + Date.now(),
          titel: "Neue Aufgabe",
          beschreibung: "",
          bereich: nb[bIdx].name,
          lv_positionen: [],
          materialien: [],
          prioritaet: "mittel",
          erledigt: false,
        }],
      };
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
    setVorschau(v => {
      if (!v) return v;
      return { ...v, bereiche: [...v.bereiche, { name: "Neuer Bereich", beschreibung: "", aufgaben: [] }] };
    });
  }

  const prioritaetFarbe = (p: string) => p === "hoch" ? "#E24B4A" : p === "mittel" ? "#BA7517" : "#888";

  // ── UPLOAD BEREICH ────────────────────────────────────────────────────────────
  if (!vorschau) {
    return (
      <div>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#222", marginBottom: 4 }}>🤖 Baustellenstruktur aus Dokumenten</div>
        <div style={{ fontSize: 12, color: "#aaa", marginBottom: 20 }}>Lade Projektunterlagen hoch – KI erstellt automatisch eine strukturierte Baustellenplanung</div>

        {!kannAnalysieren ? (
          <div style={{ ...C.card, textAlign: "center", color: "#bbb", padding: 32 }}>Kein Zugriff für diese Rolle</div>
        ) : (
          <>
            {/* Drop Zone */}
            <div ref={dropRef}
              onDragOver={e => { e.preventDefault(); (dropRef.current as any).style.borderColor = ACCENT; }}
              onDragLeave={() => { (dropRef.current as any).style.borderColor = "#e8eaed"; }}
              onDrop={e => { e.preventDefault(); handleFiles(e.dataTransfer.files); (dropRef.current as any).style.borderColor = "#e8eaed"; }}
              onClick={() => fileRef.current?.click()}
              style={{ border: "2px dashed #e8eaed", borderRadius: 16, padding: 40, textAlign: "center", cursor: "pointer", marginBottom: 16, transition: "border-color 0.2s", background: "#fafafa" }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>📂</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#333", marginBottom: 4 }}>Dokumente hier ablegen</div>
              <div style={{ fontSize: 12, color: "#aaa" }}>PDF, Excel (.xlsx), GAEB (.x83, .x81), Word (.docx)</div>
              <input ref={fileRef} type="file" multiple accept=".pdf,.xlsx,.xls,.x83,.x81,.gaeb,.docx,.doc,.csv,.txt"
                style={{ display: "none" }} onChange={e => handleFiles(e.target.files)} />
            </div>

            {/* Hochgeladene Dateien */}
            {dateien.length > 0 && (
              <div style={{ ...C.card, marginBottom: 16, padding: "14px 16px" }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#222", marginBottom: 10 }}>
                  {dateien.length} Datei{dateien.length !== 1 ? "en" : ""} ausgewählt
                </div>
                {dateien.map((f, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", borderBottom: "1px solid #f5f5f5" }}>
                    <span style={{ fontSize: 18 }}>{getFileIcon(f.name)}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: "#222" }}>{f.name}</div>
                      <div style={{ fontSize: 11, color: "#aaa" }}>{Math.round(f.size / 1024)} KB</div>
                    </div>
                    <button onClick={() => removeFile(i)}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "#E24B4A", fontSize: 16, padding: "0 4px" }}>✕</button>
                  </div>
                ))}
              </div>
            )}

            {/* Analyse Button */}
            {dateien.length > 0 && (
              <button onClick={analyseStarten} disabled={analyzing}
                style={{ ...C.btnP, width: "100%", padding: "14px", fontSize: 14, opacity: analyzing ? 0.7 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                {analyzing ? fortschritt || "Analysiert..." : "✦ KI-Analyse starten"}
              </button>
            )}

            {/* Fortschritt */}
            {analyzing && (
              <div style={{ ...C.card, marginTop: 16, textAlign: "center", padding: 24, background: "#f8fffe", border: "1px solid " + ACCENT + "44" }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>🤖</div>
                <div style={{ fontSize: 13, color: ACCENT, fontWeight: 500 }}>{fortschritt}</div>
                <div style={{ fontSize: 11, color: "#aaa", marginTop: 6 }}>Das kann 20-40 Sekunden dauern...</div>
              </div>
            )}

            {/* Hinweise */}
            <div style={{ ...C.card, marginTop: 16, padding: "12px 14px", background: "#f8f8ff" }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#555", marginBottom: 6 }}>💡 Tipps für beste Ergebnisse</div>
              <div style={{ fontSize: 11, color: "#777", lineHeight: 1.7 }}>
                • <strong>LV als GAEB (.x83)</strong> liefert die besten Ergebnisse<br/>
                • <strong>Ausschreibung als PDF</strong> wird automatisch analysiert<br/>
                • <strong>Terminplan</strong> wird für Aufgaben-Priorisierung genutzt<br/>
                • Je mehr Dokumente, desto besser die Struktur
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  // ── VORSCHAU ──────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Vorschau Header */}
      <div style={{ ...C.card, marginBottom: 16, padding: "16px", background: "#f8fffe", border: "1px solid " + ACCENT + "44" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
          <div>
            <div style={{ fontSize: 11, color: ACCENT, fontWeight: 600, marginBottom: 4 }}>✦ KI-VORSCHAU – Bitte prüfen und ggf. anpassen</div>
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
          style={{ ...C.inp, marginTop: 10, marginBottom: 0, fontSize: 12, resize: "vertical" as any }} rows={2} placeholder="Projektbeschreibung..." />
      </div>

      {/* Annahmen der KI */}
      {vorschau.annahmen?.length > 0 && (
        <div style={{ ...C.card, marginBottom: 16, padding: "12px 14px", background: "#fff8e1", border: "1px solid #BA751733" }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#BA7517", marginBottom: 6 }}>⚠ KI hat folgende Annahmen getroffen:</div>
          {vorschau.annahmen.map((a, i) => (
            <div key={i} style={{ fontSize: 11, color: "#666", marginBottom: 2 }}>• {a}</div>
          ))}
        </div>
      )}

      {/* Statistiken */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
        {[
          ["Bereiche", vorschau.bereiche.length, "🏗"],
          ["Aufgaben", vorschau.bereiche.reduce((s, b) => s + b.aufgaben.length, 0), "✓"],
          ["Materialien", vorschau.materialien?.length || 0, "📦"],
        ].map(([label, val, icon]) => (
          <div key={label as string} style={{ ...C.card, textAlign: "center", padding: "12px 8px" }}>
            <div style={{ fontSize: 20 }}>{icon}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: ACCENT }}>{val}</div>
            <div style={{ fontSize: 11, color: "#aaa" }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Bereiche und Aufgaben */}
      {vorschau.bereiche.map((bereich, bIdx) => (
        <div key={bIdx} style={{ ...C.card, marginBottom: 14, padding: "14px 16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ flex: 1 }}>
              <input value={bereich.name} onChange={e => setVorschau(v => {
                if (!v) return v;
                const nb = [...v.bereiche];
                nb[bIdx] = { ...nb[bIdx], name: e.target.value };
                return { ...v, bereiche: nb };
              })} style={{ fontSize: 14, fontWeight: 700, color: "#222", border: "none", borderBottom: "1px solid #eee", background: "transparent", outline: "none", width: "100%" }} />
              <input value={bereich.beschreibung} onChange={e => setVorschau(v => {
                if (!v) return v;
                const nb = [...v.bereiche];
                nb[bIdx] = { ...nb[bIdx], beschreibung: e.target.value };
                return { ...v, bereiche: nb };
              })} style={{ fontSize: 12, color: "#888", border: "none", background: "transparent", outline: "none", width: "100%", marginTop: 2 }} placeholder="Bereichsbeschreibung..." />
            </div>
            <span style={{ fontSize: 11, color: "#bbb", background: "#f5f5f5", padding: "2px 8px", borderRadius: 10, marginLeft: 10 }}>{bereich.aufgaben.length} Aufgaben</span>
          </div>

          {/* Aufgaben */}
          {bereich.aufgaben.map((aufgabe, aIdx) => (
            <div key={aufgabe.id} style={{ background: "#f8fffe", borderRadius: 10, border: "1px solid #e8f5f3", padding: "12px 14px", marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, flexWrap: "wrap" }}>
                    <select value={aufgabe.prioritaet} onChange={e => updateAufgabe(bIdx, aIdx, { prioritaet: e.target.value as any })}
                      style={{ fontSize: 10, padding: "1px 6px", borderRadius: 6, border: "1px solid " + prioritaetFarbe(aufgabe.prioritaet), color: prioritaetFarbe(aufgabe.prioritaet), background: prioritaetFarbe(aufgabe.prioritaet) + "18", cursor: "pointer", outline: "none" }}>
                      <option value="hoch">● Hoch</option>
                      <option value="mittel">● Mittel</option>
                      <option value="niedrig">● Niedrig</option>
                    </select>
                    {aufgabe.termine && <span style={{ fontSize: 10, color: "#7986CB", background: "#7986CB18", padding: "1px 6px", borderRadius: 6 }}>📅 {aufgabe.termine}</span>}
                    {aufgabe.annahme && <span style={{ fontSize: 10, color: "#BA7517", background: "#BA751718", padding: "1px 6px", borderRadius: 6 }}>⚠ Annahme</span>}
                  </div>
                  <input value={aufgabe.titel} onChange={e => updateAufgabe(bIdx, aIdx, { titel: e.target.value })}
                    style={{ fontSize: 13, fontWeight: 600, color: "#222", border: "none", borderBottom: "1px solid #eee", background: "transparent", outline: "none", width: "100%", marginBottom: 4 }} />
                  <textarea value={aufgabe.beschreibung} onChange={e => updateAufgabe(bIdx, aIdx, { beschreibung: e.target.value })}
                    style={{ fontSize: 12, color: "#555", border: "none", background: "transparent", outline: "none", width: "100%", resize: "vertical" as any, lineHeight: 1.5, fontFamily: "system-ui" }} rows={2} placeholder="Beschreibung für Vorarbeiter..." />
                </div>
                <button onClick={() => removeAufgabe(bIdx, aIdx)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#E24B4A", fontSize: 14, flexShrink: 0 }}>✕</button>
              </div>

              {/* LV-Positionen */}
              {aufgabe.lv_positionen?.length > 0 && (
                <div style={{ marginTop: 8, padding: "8px 10px", background: "#fff", borderRadius: 8, border: "1px solid #eee" }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: "#aaa", marginBottom: 4 }}>LV-POSITIONEN</div>
                  {aufgabe.lv_positionen.map((lv, li) => (
                    <div key={li} style={{ fontSize: 11, color: "#555", padding: "2px 0", display: "flex", gap: 8 }}>
                      <span style={{ color: ACCENT, fontWeight: 600, minWidth: 40 }}>{lv.nr}</span>
                      <span style={{ flex: 1 }}>{lv.beschreibung}</span>
                      {lv.menge && <span style={{ color: "#888" }}>{lv.menge} {lv.einheit}</span>}
                    </div>
                  ))}
                </div>
              )}

              {/* Materialien */}
              {aufgabe.materialien?.length > 0 && (
                <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {aufgabe.materialien.map((m, mi) => (
                    <span key={mi} style={{ fontSize: 10, padding: "2px 7px", borderRadius: 6, background: "#f0f4f3", color: "#555" }}>
                      📦 {m.name} {m.menge} {m.einheit}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}

          <button onClick={() => addAufgabe(bIdx)}
            style={{ ...C.btnS, fontSize: 12, width: "100%", marginTop: 4 }}>+ Aufgabe hinzufügen</button>
        </div>
      ))}

      <button onClick={addBereich} style={{ ...C.btnS, width: "100%", marginBottom: 16 }}>+ Bereich hinzufügen</button>

      {/* Materialübersicht */}
      {vorschau.materialien?.length > 0 && (
        <div style={{ ...C.card, marginBottom: 16, padding: "14px 16px" }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#222", marginBottom: 10 }}>📦 Materialübersicht</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 8 }}>
            {vorschau.materialien.map((m, i) => (
              <div key={i} style={{ padding: "8px 12px", background: "#f8fffe", borderRadius: 8, border: "1px solid #e8f5f3" }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#222" }}>{m.name}</div>
                <div style={{ fontSize: 11, color: ACCENT }}>{m.menge} {m.einheit}</div>
                {m.lv_pos && <div style={{ fontSize: 10, color: "#aaa" }}>LV: {m.lv_pos}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Übernehmen Button unten */}
      <button onClick={baustelleUebernehmen} disabled={saving || gespeichert}
        style={{ ...C.btnP, width: "100%", padding: "14px", fontSize: 14, background: gespeichert ? "#1D9E75" : ACCENT }}>
        {gespeichert ? "✓ Baustelle erfolgreich übernommen!" : saving ? "Wird gespeichert..." : "✓ Baustelle in BauManager übernehmen"}
      </button>
    </div>
  );
}
