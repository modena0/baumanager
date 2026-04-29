import { useState, useEffect, useRef } from "react";
import { C, ACCENT } from "../lib/constants";
import { supabase } from "../lib/supabase";

const EINHEITEN = ["m³", "m²", "m", "t", "kg", "Stück", "l", "to", "Palette"];
const MATERIAL_STATUS = ["geliefert", "verbaut", "gelagert"];
const FOTO_TYPEN = ["allgemein", "Material", "Lieferschein", "Einbauort", "Schaden", "Abnahme"];

const WETTER_DE: Record<string, string> = {
  "Sunny": "Sonnig", "Clear": "Klar", "Partly cloudy": "Teilweise bewölkt",
  "Cloudy": "Bewölkt", "Overcast": "Bedeckt", "Mist": "Neblig",
  "Patchy rain possible": "Leichter Regen möglich", "Fog": "Nebel",
  "Light rain": "Leichter Regen", "Moderate rain": "Mäßiger Regen",
  "Heavy rain": "Starker Regen", "Light snow": "Leichter Schnee",
  "Moderate snow": "Mäßiger Schnee", "Heavy snow": "Starker Schnee",
  "Thunder": "Gewitter", "Thunderstorm": "Gewitter",
  "Patchy light rain": "Leichter Regen", "Light drizzle": "Nieselregen",
  "Light rain shower": "Leichter Regenschauer",
  "Moderate or heavy rain shower": "Starker Regenschauer",
};
function wetterDE(en: string): string { return WETTER_DE[en] || en; }

interface Eintrag {
  id?: number;
  baustelle_id: number;
  datum: string;
  wetter?: string;
  temperatur?: string;
  wind?: string;
  niederschlag?: string;
  arbeitsbeginn?: string;
  arbeitsende?: string;
  mitarbeiter_anwesend: number[];
  geraete: string[];
  notizen?: string;
  besonderheiten?: string;
  erstellt_von?: string;
}

interface Material {
  id?: number;
  eintrag_id?: number;
  baustelle_id: number;
  datum: string;
  materialart: string;
  menge?: number;
  einheit?: string;
  einbauort?: string;
  lv_position?: string;
  lieferant?: string;
  lieferschein_nr?: string;
  lieferschein_foto?: string;
  status: string;
  besonderheiten?: string;
  erstellt_von?: string;
}

interface Foto {
  id?: number;
  eintrag_id?: number;
  baustelle_id: number;
  datum: string;
  url: string;
  beschreibung?: string;
  typ: string;
  erstellt_von?: string;
}

interface ChatNachricht {
  id?: number;
  baustelle_id: number;
  datum: string;
  text?: string;
  foto_url?: string;
  absender: string;
  absender_rolle?: string;
  typ: string;
  ki_verarbeitet: boolean;
  created_at?: string;
}

export function BautagebuchTab({ data, currentUser, rolle }: any) {
  const [selectedBS,  setSelectedBS]  = useState<number|null>(null);
  const [datum,       setDatum]       = useState(new Date().toISOString().split("T")[0]);
  const [eintrag,     setEintrag]     = useState<Eintrag|null>(null);
  const [materialien, setMaterialien] = useState<Material[]>([]);
  const [fotos,       setFotos]       = useState<Foto[]>([]);
  const [nachrichten, setNachrichten] = useState<ChatNachricht[]>([]);
  const [loading,     setLoading]     = useState(false);
  const [activeTab,   setActiveTab]   = useState<"chat"|"tageslog"|"material"|"fotos"|"uebersicht">("chat");
  const [showMatForm, setShowMatForm] = useState(false);
  const [editMat,     setEditMat]     = useState<Material|null>(null);
  const [wetterLoad,  setWetterLoad]  = useState(false);
  const [fotoUpload,  setFotoUpload]  = useState(false);
  const [selectedTyp, setSelectedTyp] = useState<string|null>(null);
  const [lightbox,    setLightbox]    = useState<any|null>(null);
  const [kiLaeuft,    setKiLaeuft]   = useState(false);

  const isMobile = window.innerWidth < 768;
  const meineBS = rolle === "baustellen_leitung"
    ? data.baustellen.filter((b: any) => b.mitarbeiter?.includes(currentUser?.id))
    : data.baustellen.filter((b: any) => b.status !== "abgeschlossen");

  useEffect(() => { if (selectedBS) loadAlles(); }, [selectedBS, datum]);

  // Automatischer Refresh alle 10 Sekunden für Chat
  useEffect(() => {
    if (!selectedBS || activeTab !== "chat") return;
    const interval = setInterval(() => ladeChatNachrichten(), 10000);
    return () => clearInterval(interval);
  }, [selectedBS, datum, activeTab]);

  // KI-Verarbeitung stündlich
  useEffect(() => {
    if (!selectedBS) return;
    const interval = setInterval(() => kiVerarbeitung(), 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [selectedBS, datum]);

  async function loadAlles() {
    setLoading(true);
    await Promise.all([ladeEintrag(), ladeMaterial(), ladeFotos(), ladeChatNachrichten()]);
    setLoading(false);
  }

  async function ladeEintrag() {
    const { data: e } = await supabase.from("bautagebuch_eintraege")
      .select("*").eq("baustelle_id", selectedBS!).eq("datum", datum).maybeSingle();
    if (e) {
      setEintrag({ ...e, mitarbeiter_anwesend: Array.isArray(e.mitarbeiter_anwesend) ? e.mitarbeiter_anwesend.map(Number) : [], geraete: Array.isArray(e.geraete) ? e.geraete : [] });
    } else {
      setEintrag({ baustelle_id: selectedBS!, datum, mitarbeiter_anwesend: [], geraete: [] });
    }
  }

  async function ladeMaterial() {
    const { data: m } = await supabase.from("bautagebuch_material").select("*").eq("baustelle_id", selectedBS!).eq("datum", datum).order("id");
    setMaterialien(m || []);
  }

  async function ladeFotos() {
    const { data: f } = await supabase.from("bautagebuch_fotos").select("*").eq("baustelle_id", selectedBS!).eq("datum", datum).order("id");
    setFotos(f || []);
  }

  async function ladeChatNachrichten() {
    const { data: n } = await supabase.from("chat_nachrichten").select("*").eq("baustelle_id", selectedBS!).eq("datum", datum).order("created_at");
    setNachrichten(n || []);
  }

  async function saveEintrag(e: Eintrag) {
    const p = { ...e, erstellt_von: currentUser?.name || "" };
    if (e.id) {
      await supabase.from("bautagebuch_eintraege").update(p).eq("id", e.id);
      setEintrag(p);
    } else {
      const { data: neu } = await supabase.from("bautagebuch_eintraege").insert([p]).select().single();
      if (neu) setEintrag({ ...p, id: neu.id });
    }
  }

  async function ensureEintrag(): Promise<number|null> {
    if (eintrag?.id) return eintrag.id;
    const p = { baustelle_id: selectedBS!, datum, mitarbeiter_anwesend: [], geraete: [], erstellt_von: currentUser?.name || "" };
    const { data: neu } = await supabase.from("bautagebuch_eintraege").insert([p]).select().single();
    if (neu) { setEintrag({ ...p, id: neu.id }); return neu.id; }
    return null;
  }

  async function wetterLaden() {
    if (!selectedBS) return;
    setWetterLoad(true);
    const bs = data.baustellen.find((b: any) => b.id === selectedBS);
    const ort = bs?.ort || "Dresden";
    try {
      const res = await fetch(`https://wttr.in/${encodeURIComponent(ort)}?format=j1`);
      const d = await res.json();
      const w = d.current_condition?.[0];
      if (w && eintrag) {
        const updated = { ...eintrag, temperatur: w.temp_C + "°C", wetter: wetterDE(w.weatherDesc?.[0]?.value || ""), wind: w.windspeedKmph + " km/h", niederschlag: w.precipMM + " mm" };
        setEintrag(updated);
        await saveEintrag(updated);
      }
    } catch { if (eintrag) setEintrag({ ...eintrag, wetter: "Nicht abrufbar" }); }
    setWetterLoad(false);
  }

  async function saveMaterial(m: Material) {
    const p: any = { baustelle_id: selectedBS!, datum, materialart: m.materialart, status: m.status || "geliefert", erstellt_von: currentUser?.name || "" };
    const eintragsId = await ensureEintrag();
    if (eintragsId) p.eintrag_id = eintragsId;
    if (m.menge !== undefined) p.menge = m.menge;
    if (m.einheit) p.einheit = m.einheit;
    if (m.einbauort) p.einbauort = m.einbauort;
    if (m.lv_position) p.lv_position = m.lv_position;
    if (m.lieferant) p.lieferant = m.lieferant;
    if (m.lieferschein_nr) p.lieferschein_nr = m.lieferschein_nr;
    if (m.lieferschein_foto) p.lieferschein_foto = m.lieferschein_foto;
    if (m.besonderheiten) p.besonderheiten = m.besonderheiten;
    if (m.id) {
      const { error } = await supabase.from("bautagebuch_material").update(p).eq("id", m.id);
      if (!error) setMaterialien(ms => ms.map(x => x.id === m.id ? { ...p, id: m.id } : x));
    } else {
      const { data: neu, error } = await supabase.from("bautagebuch_material").insert([p]).select().single();
      if (!error && neu) setMaterialien(ms => [...ms, { ...p, id: neu.id }]);
    }
    setShowMatForm(false); setEditMat(null);
  }

  async function deleteMaterial(id: number) {
    await supabase.from("bautagebuch_material").delete().eq("id", id);
    setMaterialien(ms => ms.filter(m => m.id !== id));
  }

  async function fotosHochladen(files: FileList, typ: string) {
    if (!files.length || !selectedBS) return;
    setFotoUpload(true);
    const eintragsId = await ensureEintrag();
    for (const file of Array.from(files)) {
      let url = "";
      const fileName = `bautagebuch/${selectedBS}/${datum}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { data: uploadData, error: uploadError } = await supabase.storage.from("dokumente").upload(fileName, file, { upsert: true });
      if (!uploadError && uploadData) {
        const { data: urlData } = supabase.storage.from("dokumente").getPublicUrl(fileName);
        url = urlData.publicUrl;
      } else {
        url = await komprimieren(file, 800, 0.7);
      }
      if (!url) continue;
      const foto: any = { baustelle_id: selectedBS, datum, url, typ, erstellt_von: currentUser?.name || "" };
      if (eintragsId) foto.eintrag_id = eintragsId;
      const { data: neu } = await supabase.from("bautagebuch_fotos").insert([foto]).select().single();
      if (neu) setFotos(fs => [...fs, { ...foto, id: neu.id }]);
    }
    setFotoUpload(false);
    setSelectedTyp(null);
  }

  async function komprimieren(file: File, maxSize: number, quality: number): Promise<string> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          let w = img.width; let h = img.height;
          if (w > maxSize) { h = h * maxSize / w; w = maxSize; }
          if (h > maxSize) { w = w * maxSize / h; h = maxSize; }
          canvas.width = w; canvas.height = h;
          canvas.getContext("2d")?.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL("image/jpeg", quality));
        };
        img.src = ev.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  }

  async function deleteFoto(id: number) {
    await supabase.from("bautagebuch_fotos").delete().eq("id", id);
    setFotos(fs => fs.filter(f => f.id !== id));
  }

  // ── KI Verarbeitung ────────────────────────────────────────────────────────────
  async function kiVerarbeitung() {
    if (!selectedBS || kiLaeuft) return;
    // Nur echte Nutzernachrichten verarbeiten, nicht Saschas eigene
    const unverarbeitet = nachrichten.filter(n => !n.ki_verarbeitet && n.absender !== "Sascha");
    if (unverarbeitet.length === 0) { alert("Keine neuen Nachrichten zum Verarbeiten."); return; }
    setKiLaeuft(true);

    const bs = data.baustellen.find((b: any) => b.id === selectedBS);
    const prompt = `Du bist ein Bautagebuch-Assistent. Analysiere folgende Chat-Nachrichten von der Baustelle "${bs?.name}" für das Datum ${datum}.

NACHRICHTEN:
${unverarbeitet.map(n => `[${n.absender}]: ${n.text || "[Foto]"}`).join("\n")}

Extrahiere strukturierte Informationen. Antworte NUR mit diesem JSON, kein anderer Text:
{
  "notizen": "Kurze Zusammenfassung der ausgeführten Arbeiten (oder null)",
  "besonderheiten": "Probleme, Verzögerungen, besondere Ereignisse (oder null)",
  "arbeitsbeginn": "HH:MM falls erkennbar (oder null)",
  "arbeitsende": "HH:MM falls erkennbar (oder null)",
  "materialien": [
    { "materialart": "z.B. Beton", "menge": 10, "einheit": "m³", "einbauort": "Ort oder null", "status": "verbaut" }
  ]
}`;

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1000, messages: [{ role: "user", content: prompt }] }),
      });
      const d = await res.json();
      const txt = d.content?.[0]?.text;
      if (!txt) throw new Error("Keine Antwort von KI");

      const jsonMatch = txt.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("Kein JSON in Antwort");
      const ki = JSON.parse(jsonMatch[0]);

      // Eintrag sicherstellen (insert falls nicht vorhanden)
      let eintragsId = eintrag?.id;
      if (!eintragsId) {
        const { data: neu } = await supabase.from("bautagebuch_eintraege").insert([{
          baustelle_id: selectedBS, datum,
          mitarbeiter_anwesend: [], geraete: [],
          erstellt_von: currentUser?.name || "KI",
        }]).select().single();
        if (neu) { eintragsId = neu.id; setEintrag({ ...neu, mitarbeiter_anwesend: [], geraete: [] }); }
      }

      // Tageseintrag aktualisieren
      if (eintragsId) {
        const aktuellerEintrag = eintrag || {};
        const updated: any = {
          ...aktuellerEintrag,
          id: eintragsId,
          baustelle_id: selectedBS,
          datum,
        };
        if (ki.notizen) updated.notizen = (aktuellerEintrag as any).notizen
          ? (aktuellerEintrag as any).notizen + "\n\n[KI " + new Date().toLocaleTimeString("de-DE", {hour:"2-digit",minute:"2-digit"}) + "]: " + ki.notizen
          : ki.notizen;
        if (ki.besonderheiten) updated.besonderheiten = ki.besonderheiten;
        if (ki.arbeitsbeginn) updated.arbeitsbeginn = ki.arbeitsbeginn;
        if (ki.arbeitsende) updated.arbeitsende = ki.arbeitsende;

        await supabase.from("bautagebuch_eintraege").update(updated).eq("id", eintragsId);
        setEintrag(updated);
      }

      // Materialien speichern
      if (ki.materialien?.length) {
        for (const m of ki.materialien) {
          if (!m.materialart) continue;
          const p: any = {
            baustelle_id: selectedBS, datum,
            materialart: m.materialart,
            status: m.status || "verbaut",
            erstellt_von: "KI-Assistent",
          };
          if (eintragsId) p.eintrag_id = eintragsId;
          if (m.menge)    p.menge = m.menge;
          if (m.einheit)  p.einheit = m.einheit;
          if (m.einbauort && m.einbauort !== "null") p.einbauort = m.einbauort;
          const { data: neu } = await supabase.from("bautagebuch_material").insert([p]).select().single();
          if (neu) setMaterialien((ms: any[]) => [...ms, { ...p, id: neu.id }]);
        }
      }

      // Nachrichten als verarbeitet markieren
      for (const n of unverarbeitet) {
        if (n.id) await supabase.from("chat_nachrichten").update({ ki_verarbeitet: true }).eq("id", n.id);
      }
      setNachrichten((ns: any[]) => ns.map(n =>
        unverarbeitet.find((u: any) => u.id === n.id) ? { ...n, ki_verarbeitet: true } : n
      ));

      alert(`✓ KI hat ${unverarbeitet.length} Nachrichten verarbeitet!`);

    } catch (e: any) {
      console.error("KI Fehler:", e);
      alert("KI-Fehler: " + e.message);
    }
    setKiLaeuft(false);
  }

  // ── PDF Export nach DVT-Vorlage ───────────────────────────────────────────────
  async function exportPDF() {
    if (!selectedBS || !eintrag) return;
    const bs = data.baustellen.find((b: any) => b.id === selectedBS);

    // jsPDF dynamisch laden
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
    document.head.appendChild(script);
    await new Promise(r => { script.onload = r; });
    const { jsPDF } = (window as any).jspdf;

    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const H = 297; // A4 Höhe in mm

    // Hilfsfunktionen
    const yrl = (y: number) => y; // jsPDF nutzt y von oben – passt direkt!

    const hline = (x1: number, x2: number, y: number, lw = 0.3) => {
      doc.setLineWidth(lw); doc.setDrawColor(0);
      doc.line(x1, y, x2, y);
    };
    const vline = (x: number, y1: number, y2: number, lw = 0.3) => {
      doc.setLineWidth(lw); doc.setDrawColor(0);
      doc.line(x, y1, x, y2);
    };
    const fillrect = (x: number, y: number, w: number, h: number, r: number, g: number, b: number) => {
      doc.setFillColor(r, g, b); doc.setDrawColor(0); doc.setLineWidth(0.3);
      doc.rect(x, y, w, h, "FD");
      doc.setFillColor(0, 0, 0);
    };
    const t = (x: number, y: number, s: string, size = 7.5, bold = false) => {
      doc.setFont("helvetica", bold ? "bold" : "normal");
      doc.setFontSize(size);
      doc.setTextColor(0);
      doc.text(s, x, y);
    };
    const tr = (x: number, y: number, s: string, size = 7.5) => {
      doc.setFont("helvetica", "normal"); doc.setFontSize(size);
      doc.text(s, x, y, { align: "right" });
    };
    const tc = (x: number, y: number, s: string, size = 7.5) => {
      doc.setFont("helvetica", "normal"); doc.setFontSize(size);
      doc.text(s, x, y, { align: "center" });
    };

    // ── ÄUSSERER RAHMEN ─────────────────────────────────────────────────────
    hline(15.7, 204.4, 6.4, 0.5);
    vline(15.7, 6.4, 54.1, 0.5);
    vline(204.4, 6.4, 54.1, 0.5);
    hline(15.7, 204.4, 54.1, 0.8);
    vline(15.7, 54.1, 290.2, 0.5);
    vline(204.4, 54.1, 290.2, 0.5);
    hline(15.7, 204.4, 290.2, 0.5);

    // ── LOGO ────────────────────────────────────────────────────────────────
    doc.setFillColor(22, 96, 168);
    doc.rect(150, 6.4, 54, 22, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold"); doc.setFontSize(20);
    doc.text("DVT", 152, 19);
    doc.setFontSize(13);
    doc.text(">>", 167, 20);
    doc.setTextColor(0, 0, 0);

    // Firmenname + Adresse
    t(148, 30.5, "Dresdner Verkehrstechnik GmbH", 9, true);
    t(164.5, 34.8, "Zur Wetterwarte 27", 7.5);
    t(164.5, 38.7, "01109 Dresden", 7.5);
    t(164.5, 42.5, "0351/21 527 200", 7.5);
    t(164.5, 46.4, "0351/21 527 220", 7.5);

    // Titel
    t(16.8, 44, "Bautagebuch", 20, true);

    // ── HEADER ──────────────────────────────────────────────────────────────
    // Zeile 1: Nr + Datum
    hline(15.7, 204.4, 59.7); vline(130, 54.1, 59.7); vline(148, 54.1, 59.7); vline(165, 54.1, 59.7);
    t(134.5, 58.5, "Nr.", 7.5, true);
    t(144.1, 58.5, String(data.baustellen.indexOf(bs) + 1 || 1), 7.5, true);
    t(166.1, 58.5, "Datum:", 7.5, true);
    tr(202, 58.5, datum.split("-").reverse().join("."));

    // Zeile 2: Baustelle + Wetter
    hline(15.7, 204.4, 65.1); vline(130, 59.7, 65.1); vline(148, 59.7, 65.1);
    t(16.5, 63.5, "Baustelle:", 7.5, true);
    t(42.7, 63.5, bs?.name || "");
    t(123.9, 63.5, "Wetter:", 7.5, true);
    t(148.5, 63.5, eintrag.wetter || "");

    // Zeile 3: Arbeitszeit + Temperatur
    hline(15.7, 204.4, 70.5);
    vline(130, 65.1, 70.5); vline(148, 65.1, 70.5); vline(166, 65.1, 70.5);
    vline(178, 65.1, 70.5); vline(190, 65.1, 70.5);
    t(16.5, 69, "Arbeitszeit:", 7.5, true);
    if (eintrag.arbeitsbeginn) t(40, 69, eintrag.arbeitsbeginn);
    t(67.9, 68.8, "bis");
    if (eintrag.arbeitsende) t(73, 69, eintrag.arbeitsende);
    t(123.9, 69, "Temperatur min.", 7.5, true);
    if (eintrag.temperatur) t(152.5, 69, eintrag.temperatur.replace("°C","").trim());
    t(157.3, 68.8, "°C");
    t(170.9, 68.8, "max.", 7.5, true);
    t(186, 68.8, "°C");
    hline(15.7, 204.4, 74.3);

    // ── PERSONAL + GERÄTE ───────────────────────────────────────────────────
    const C_cols = [15.7, 22.9, 61.1, 78.5, 149.5, 163.8, 185.3, 204.4];
    fillrect(15.7, 74.3, 188.7, 5.4, 216, 216, 216);
    C_cols.slice(1,7).forEach(x => vline(x, 74.3, 84.3));
    t(16.5, 78.3, "Personaleinsatz", 7.5, true);
    t(67.3, 78.3, "Std.", 7.5, true);
    t(79.3, 78.3, "Geräte-/LKW-Einsatz", 7.5, true);
    t(139, 78.3, "Art des", 7.5, true);
    t(154.1, 78.3, "Std.", 7.5, true);
    t(174.4, 78.3, "Bemerkungen", 7.5, true);

    hline(15.7, 204.4, 84.3);
    fillrect(15.7, 79.7, 188.7, 4.6, 216, 216, 216);
    C_cols.slice(1,7).forEach(x => vline(x, 79.7, 84.3));
    t(16.5, 83.2, "Anzahl");
    t(79.3, 83.2, "Gerätes");

    // Personal aus anwesenden Mitarbeitern
    const anwesendeMa = eintrag.mitarbeiter_anwesend.map((id: number) => {
      const m = data.mitarbeiter.find((x: any) => x.id === id);
      return m ? { rolle: m.rolle || m.name, anzahl: "1", stunden: "" } : null;
    }).filter(Boolean);

    const personalRollen = [
      { rolle: "Polier", anzahl: "", stunden: "" },
      { rolle: "Vorarbeiter", anzahl: "", stunden: "" },
      { rolle: "Facharbeiter", anzahl: "", stunden: "" },
      { rolle: "Maschinisten", anzahl: "", stunden: "" },
      { rolle: "Helfer", anzahl: "", stunden: "" },
      { rolle: "SUB", anzahl: "", stunden: "" },
      { rolle: "", anzahl: "", stunden: "" },
    ];

    const y_rows = [84.3, 89.7, 95.1, 100.5, 105.9, 111.3, 116.8];
    const ZH = 5.4;
    const geraeteData = eintrag.geraete || [];
    const nz = Math.max(personalRollen.length, geraeteData.length, y_rows.length);

    for (let i = 0; i < nz; i++) {
      const y_top = i < y_rows.length ? y_rows[i] : y_rows[y_rows.length-1] + (i-y_rows.length+1)*ZH;
      const y_next = y_top + ZH;
      hline(15.7, 204.4, y_next);
      C_cols.slice(1,7).forEach(x => vline(x, y_top, y_next));

      const p = personalRollen[i];
      if (p) {
        if (p.anzahl) tc((22.9+C_cols[0])/2 + 3, y_top+3.8, p.anzahl);
        tc((22.9+61.1)/2, y_top+3.8, p.rolle);
        if (p.stunden) tc((61.1+78.5)/2, y_top+3.8, p.stunden);
      }
      if (i < geraeteData.length) {
        t(79.3, y_top+3.8, String(geraeteData[i]));
      }
    }

    // ── AUSGEFÜHRTE ARBEITEN ─────────────────────────────────────────────────
    const y_arb_h = 122.2;
    fillrect(15.7, y_arb_h, 188.7, 5.6, 216, 216, 216);
    vline(42.0, y_arb_h, y_arb_h+5.6); vline(185.3, y_arb_h, y_arb_h+5.6);
    hline(15.7, 204.4, y_arb_h+5.6);
    t(16.5, y_arb_h+4, "Ausgeführte Arbeiten:", 7.5, true);
    t(193, y_arb_h+4.5, "AK", 7.5, true);

    // Notizen als Arbeiten-Zeilen aufteilen
    const arbeitenLines = (eintrag.notizen || "").split("\n").filter((l: string) => l.trim());
    const y_arb_rows = [127.8, 133.6, 139.2, 144.8, 150.5, 156.1, 161.7, 167.3, 173.0, 178.6];
    const nA = Math.max(arbeitenLines.length, 8);
    for (let i = 0; i < nA; i++) {
      const y_top = i < y_arb_rows.length ? y_arb_rows[i] : y_arb_rows[y_arb_rows.length-1]+(i-y_arb_rows.length+1)*5.6;
      hline(15.7, 204.4, y_top+5.6);
      vline(42.0, y_top, y_top+5.6); vline(185.3, y_top, y_top+5.6);
      if (i < arbeitenLines.length) t(42.7, y_top+4, arbeitenLines[i]);
    }

    // ── BEHINDERUNGEN ────────────────────────────────────────────────────────
    const y_beh = 189.9;
    fillrect(15.7, y_beh, 188.7, 5.6, 216, 216, 216);
    hline(15.7, 204.4, y_beh+5.6);
    t(16.5, y_beh+4, "Behinderungen/Erschwernisse", 7.5, true);
    const y_beh_rows = [195.5, 201.3, 206.9];
    for (let i = 0; i < 2; i++) {
      const y_top = y_beh_rows[i];
      hline(15.7, 204.4, y_top+5.6);
      vline(42, y_top, y_top+5.6); vline(185.3, y_top, y_top+5.6);
    }

    // ── LEISTUNGSÄNDERUNGEN ──────────────────────────────────────────────────
    const y_lei = 212.5;
    fillrect(15.7, y_lei, 188.7, 5.6, 216, 216, 216);
    hline(15.7, 204.4, y_lei+5.6);
    t(16.5, y_lei+4, "Leistungsänderungen", 7.5, true);
    const y_lei_rows = [218.1, 223.9, 229.5, 235.2];
    for (let i = 0; i < 3; i++) {
      const y_top = y_lei_rows[i];
      hline(15.7, 204.4, y_top+5.6);
      vline(42, y_top, y_top+5.6); vline(185.3, y_top, y_top+5.6);
    }

    // ── BESONDERE VORKOMMNISSE ────────────────────────────────────────────────
    const y_bv = 240.8;
    fillrect(15.7, y_bv, 188.7, 8.4, 216, 216, 216);
    hline(15.7, 204.4, y_bv+8.4);
    t(16.5, y_bv+4.2, "Besondere Vorkommnisse/Sonstiges", 7.5, true);
    doc.setFont("helvetica", "normal"); doc.setFontSize(7);
    doc.text("(Begehungen/Abnahmen/…)", 16.4, y_bv+8);

    const besLines = (eintrag.besonderheiten || "").split("\n").filter((l: string) => l.trim());
    const y_bv_rows = [249.2, 255.6, 261.2];
    for (let i = 0; i < Math.max(besLines.length, 2); i++) {
      const y_top = i < y_bv_rows.length ? y_bv_rows[i] : y_bv_rows[y_bv_rows.length-1]+(i-y_bv_rows.length+1)*5.6;
      hline(15.7, 204.4, y_top+5.6);
      if (i < besLines.length) t(16.5, y_top+4, besLines[i]);
    }

    // ── UNTERSCHRIFTEN ────────────────────────────────────────────────────────
    hline(15.7, 100, 266.9, 0.5);
    hline(120, 204.4, 266.9, 0.5);
    t(16.5, 270, "Ort, Datum"); t(42.7, 270, "Dresden,");
    t(63.2, 270, datum.split("-").reverse().join("."));
    t(157.3, 270, "Ort, Datum");
    t(16.5, 276.5, "Auftragnehmer:", 7.5, true);
    t(157.3, 276.5, "Auftraggeber:", 7.5, true);
    t(133.2, 287, "erhalten:", 7.5, true);

    // Speichern
    doc.save(`Bautagebuch_${bs?.name}_${datum}.pdf`);
  }

  async function exportExcel() {
    if (!selectedBS) return;
    const { data: alleEintraege }   = await supabase.from("bautagebuch_eintraege").select("*").eq("baustelle_id", selectedBS).order("datum");
    const { data: allesMaterial }   = await supabase.from("bautagebuch_material").select("*").eq("baustelle_id", selectedBS).order("datum");
    const { data: alleNachrichten } = await supabase.from("chat_nachrichten").select("*").eq("baustelle_id", selectedBS).order("created_at");
    const bs = data.baustellen.find((b: any) => b.id === selectedBS);

    const csvRows = [
      ["Digitales Bautagebuch - " + bs?.name],
      ["Exportiert am: " + new Date().toLocaleDateString("de-DE")],
      [],
      ["=== TAGESEINTRÄGE ==="],
      ["Datum", "Wetter", "Temperatur", "Wind", "Niederschlag", "Arbeitsbeginn", "Arbeitsende", "Notizen", "Besonderheiten", "Erstellt von"],
      ...(alleEintraege || []).map((e: any) => [e.datum, e.wetter, e.temperatur, e.wind, e.niederschlag, e.arbeitsbeginn, e.arbeitsende, e.notizen, e.besonderheiten, e.erstellt_von]),
      [],
      ["=== MATERIAL ==="],
      ["Datum", "Materialart", "Menge", "Einheit", "Einbauort", "LV-Position", "Lieferant", "Lieferschein-Nr", "Status", "Besonderheiten", "Erstellt von"],
      ...(allesMaterial || []).map((m: any) => [m.datum, m.materialart, m.menge, m.einheit, m.einbauort, m.lv_position, m.lieferant, m.lieferschein_nr, m.status, m.besonderheiten, m.erstellt_von]),
      [],
      ["=== SASCHA CHAT-PROTOKOLL ==="],
      ["Datum", "Uhrzeit", "Absender", "Rolle", "Nachricht", "Typ", "KI verarbeitet"],
      ...(alleNachrichten || []).map((n: any) => [
        n.datum,
        n.created_at ? new Date(n.created_at).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }) : "",
        n.absender,
        n.absender_rolle || "",
        n.typ === "foto" ? "[Foto]" : (n.text || ""),
        n.typ,
        n.ki_verarbeitet ? "Ja" : "Nein",
      ]),
    ];

    const csvContent = "\uFEFF" + csvRows.map(r => r.map(c => `"${(c || "").toString().replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `Bautagebuch_${bs?.name}_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  }

  // ── BAUSTELLEN AUSWAHL ────────────────────────────────────────────────────────
  if (!selectedBS) {
    return (
      <div>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#222", marginBottom: 16 }}>📋 Bautagebuch – Baustelle wählen</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
          {meineBS.map((b: any) => (
            <button key={b.id} onClick={() => setSelectedBS(b.id)}
              style={{ ...C.card, textAlign: "left", border: "1.5px solid #e8eaed", cursor: "pointer", padding: 16, background: "#fff" }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#222", marginBottom: 4 }}>⛏ {b.name}</div>
              <div style={{ fontSize: 12, color: "#888" }}>{b.ort}</div>
              <div style={{ fontSize: 11, color: ACCENT, marginTop: 6 }}>{b.status}</div>
            </button>
          ))}
          {meineBS.length === 0 && <div style={{ ...C.card, textAlign: "center", color: "#bbb", padding: 32 }}>Keine aktiven Baustellen</div>}
        </div>
      </div>
    );
  }

  const bs = data.baustellen.find((b: any) => b.id === selectedBS);

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 8, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={() => { setSelectedBS(null); setEintrag(null); setMaterialien([]); setFotos([]); setNachrichten([]); }}
            style={{ padding: "6px 12px", borderRadius: 8, border: "1.5px solid #eee", background: "#fff", cursor: "pointer", fontSize: 12, color: "#555" }}>
            ← Zurück
          </button>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#222" }}>📋 {bs?.name}</div>
            <div style={{ fontSize: 11, color: "#aaa" }}>{bs?.ort}</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input type="date" value={datum} onChange={e => setDatum(e.target.value)}
            style={{ ...C.inp, marginBottom: 0, width: "auto", padding: "7px 12px" }} />
          <button onClick={exportPDF} style={{ ...C.btnP, fontSize: 12 }}>📄 PDF</button>
          <button onClick={exportExcel} style={{ ...C.btnS, fontSize: 12 }}>📊 CSV</button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div style={{ display: "flex", gap: 4, marginBottom: 12, background: "#f0f4f3", borderRadius: 12, padding: 4, overflowX: "auto", flexShrink: 0 }}>
        {[
          { key: "chat",       label: `💬 Sascha (${nachrichten.length})` },
          { key: "tageslog",   label: "📝 Tageslog" },
          { key: "material",   label: `📦 Material (${materialien.length})` },
          { key: "fotos",      label: `📷 Fotos (${fotos.length})` },
          { key: "uebersicht", label: "📊 Übersicht" },
        ].map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key as any)}
            style={{ flex: "0 0 auto", padding: "8px 14px", borderRadius: 8, border: "none", background: activeTab === t.key ? "#fff" : "transparent", cursor: "pointer", fontSize: 12, fontWeight: activeTab === t.key ? 600 : 400, color: activeTab === t.key ? ACCENT : "#888", boxShadow: activeTab === t.key ? "0 1px 4px rgba(0,0,0,0.08)" : "none" }}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? <div style={{ textAlign: "center", color: "#bbb", padding: 32 }}>Lädt...</div> : (
        <div style={{ flex: 1, minHeight: 0, overflow: activeTab === "chat" ? "hidden" : "auto" }}>

          {/* ── CHAT ─────────────────────────────────────────────────────── */}
          {activeTab === "chat" && (
            <ChatTab
              bsId={selectedBS}
              datum={datum}
              nachrichten={nachrichten}
              setNachrichten={setNachrichten}
              currentUser={currentUser}
              rolle={rolle}
              kiLaeuft={kiLaeuft}
              onKiVerarbeitung={kiVerarbeitung}
              komprimieren={komprimieren}
              bsName={bs?.name || ""}
            />
          )}

          {/* ── TAGESLOG ─────────────────────────────────────────────────── */}
          {activeTab === "tageslog" && eintrag && (
            <TageslogForm eintrag={eintrag} setEintrag={setEintrag} data={data} onSave={saveEintrag} onWetter={wetterLaden} wetterLoad={wetterLoad} isMobile={isMobile} />
          )}

          {/* ── MATERIAL ─────────────────────────────────────────────────── */}
          {activeTab === "material" && (
            <div>
              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
                <button style={C.btnP} onClick={() => { setEditMat({ baustelle_id: selectedBS!, datum, materialart: "", status: "geliefert" } as Material); setShowMatForm(true); }}>
                  + Material erfassen
                </button>
              </div>
              {materialien.length === 0 && (
                <div style={{ ...C.card, textAlign: "center", padding: 32, color: "#bbb" }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>📦</div>Noch kein Material für heute
                </div>
              )}
              {materialien.map(m => (
                <MaterialKarte key={m.id} m={m} fotos={fotos} isMobile={isMobile}
                  onEdit={() => { setEditMat(m); setShowMatForm(true); }}
                  onDelete={() => deleteMaterial(m.id!)}
                  onFotoUpload={fotosHochladen} onFotoDelete={deleteFoto} onLightbox={setLightbox} uploading={fotoUpload} />
              ))}
            </div>
          )}

          {/* ── FOTOS ────────────────────────────────────────────────────── */}
          {activeTab === "fotos" && (
            <div>
              <div style={{ ...C.card, marginBottom: 16, padding: "16px" }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#222", marginBottom: 12 }}>📷 Fotos hochladen</div>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, color: "#888", marginBottom: 6 }}>1. Kategorie wählen:</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {FOTO_TYPEN.map(typ => (
                      <button key={typ} onClick={() => setSelectedTyp(selectedTyp === typ ? null : typ)}
                        style={{ padding: "6px 12px", borderRadius: 10, border: "1.5px solid " + (selectedTyp === typ ? ACCENT : "#eee"), background: selectedTyp === typ ? "#e8f5f3" : "#fff", color: selectedTyp === typ ? ACCENT : "#555", cursor: "pointer", fontSize: 12, fontWeight: selectedTyp === typ ? 600 : 400 }}>
                        {typ}
                      </button>
                    ))}
                  </div>
                </div>
                {selectedTyp && (
                  <div>
                    <div style={{ fontSize: 11, color: "#888", marginBottom: 8 }}>2. Fotos auswählen:</div>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <label style={{ ...C.btnP, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, opacity: fotoUpload ? 0.6 : 1 }}>
                        📸 Kamera
                        <input type="file" accept="image/*" capture="environment" multiple style={{ display: "none" }} onChange={e => e.target.files && fotosHochladen(e.target.files, selectedTyp)} />
                      </label>
                      <label style={{ ...C.btnS, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, opacity: fotoUpload ? 0.6 : 1 }}>
                        🖼 Aus Galerie
                        <input type="file" accept="image/*" multiple style={{ display: "none" }} onChange={e => e.target.files && fotosHochladen(e.target.files, selectedTyp)} />
                      </label>
                    </div>
                    {fotoUpload && <div style={{ fontSize: 12, color: ACCENT, marginTop: 8 }}>⏳ Fotos werden hochgeladen...</div>}
                  </div>
                )}
              </div>
              {fotos.length === 0 ? (
                <div style={{ ...C.card, textAlign: "center", padding: 32, color: "#bbb" }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>📷</div>
                  <div>Noch keine Fotos für heute</div>
                </div>
              ) : (
                FOTO_TYPEN.filter(typ => fotos.some(f => f.typ === typ)).map(typ => (
                  <div key={typ} style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#888", marginBottom: 8, textTransform: "uppercase" as any }}>
                      {typ} ({fotos.filter(f => f.typ === typ).length})
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr 1fr 1fr", gap: 10 }}>
                      {fotos.filter(f => f.typ === typ).map(f => (
                        <div key={f.id} style={{ borderRadius: 10, overflow: "hidden", border: "1px solid #eee", position: "relative", background: "#f8f8f8" }}>
                          <div onClick={() => setLightbox(f)} style={{ cursor: "pointer", width: "100%", height: 130, overflow: "hidden" }}>
                            <img src={f.url} alt={f.typ} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", pointerEvents: "none" }} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                          </div>
                          <div style={{ padding: "6px 8px" }}>
                            <div style={{ fontSize: 10, color: "#aaa" }}>{f.erstellt_von}</div>
                          </div>
                          <button onClick={e => { e.stopPropagation(); deleteFoto(f.id!); }}
                            style={{ position: "absolute", top: 6, right: 6, background: "rgba(0,0,0,0.55)", border: "none", borderRadius: "50%", width: 24, height: 24, cursor: "pointer", color: "#fff", fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center" }}>
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* ── ÜBERSICHT ────────────────────────────────────────────────── */}
          {activeTab === "uebersicht" && <UebersichtTab bsId={selectedBS} />}
        </div>
      )}

      {/* Material Modal */}
      {showMatForm && editMat && (
        <MaterialFormular material={editMat} isMobile={isMobile} onSave={saveMaterial} onClose={() => { setShowMatForm(false); setEditMat(null); }} />
      )}

      {/* Lightbox */}
      {lightbox && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.92)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", zIndex: 99999, cursor: "zoom-out" }}
          onClick={() => setLightbox(null)}>
          <button onClick={e => { e.stopPropagation(); setLightbox(null); }}
            style={{ position: "fixed", top: 16, right: 16, background: "rgba(255,255,255,0.15)", border: "none", borderRadius: "50%", width: 44, height: 44, cursor: "pointer", color: "#fff", fontSize: 22, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100000 }}>
            ✕
          </button>
          <img src={lightbox.url} alt={lightbox.typ} onClick={e => e.stopPropagation()}
            style={{ maxWidth: "95vw", maxHeight: "85vh", objectFit: "contain", borderRadius: 8, boxShadow: "0 4px 32px rgba(0,0,0,0.5)", cursor: "default" }} />
          <div style={{ marginTop: 14, textAlign: "center", color: "rgba(255,255,255,0.6)", fontSize: 12 }}>
            <span style={{ background: "rgba(255,255,255,0.1)", padding: "3px 10px", borderRadius: 8, marginRight: 8 }}>{lightbox.typ}</span>
            {lightbox.erstellt_von && <span>{lightbox.erstellt_von}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Chat Tab ───────────────────────────────────────────────────────────────────
function ChatTab({ bsId, datum, nachrichten, setNachrichten, currentUser, rolle, kiLaeuft, onKiVerarbeitung, komprimieren, bsName }: any) {
  const [text,        setText]        = useState("");
  const [sending,     setSending]     = useState(false);
  const [fotoSending, setFotoSending] = useState(false);
  const [saschaTyping, setSaschaTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const isMobile = window.innerWidth < 768;

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [nachrichten, saschaTyping]);

  const unverarbeitet = nachrichten.filter((n: any) => !n.ki_verarbeitet && n.absender !== "Sascha").length;

  async function sendText() {
    if (!text.trim() || sending) return;
    setSending(true);
    const nachrichtText = text.trim();
    setText("");

    const n: ChatNachricht = {
      baustelle_id: bsId,
      datum,
      text: nachrichtText,
      absender: currentUser?.name || "Unbekannt",
      absender_rolle: rolle,
      typ: "text",
      ki_verarbeitet: false,
    };

    const { data: neu } = await supabase.from("chat_nachrichten").insert([n]).select().single();
    const eigene = neu ? { ...n, id: neu.id, created_at: neu.created_at } : { ...n };

    // State updaten und dann Sascha antworten lassen
    setNachrichten((ns: any[]) => {
      const aktualisiert = [...ns, eigene];
      // Sascha antwortet mit dem aktuellen Verlauf
      setTimeout(() => saschaAntwortet(nachrichtText, aktualisiert), 0);
      return aktualisiert;
    });

    setSending(false);
  }

  async function saschaAntwortet(userText: string, verlaufNachrichten: any[]) {
    setSaschaTyping(true);

    const verlauf = verlaufNachrichten.slice(-12).map((n: any) =>
      `${n.absender}: ${n.text || "[Foto gesendet]"}`
    ).join("\n");
    const prompt = `Du bist Sascha, ein freundlicher und kompetenter digitaler Bautagebuch-Assistent.
Du bist direkt auf der Baustelle "${bsName}" dabei und hilfst dem Team alle relevanten Infos für das Bautagebuch zu erfassen.
Du kommunizierst wie ein erfahrener Kollege – locker, direkt, auf Deutsch, kurz und hilfreich.
Du bist kein Roboter – du bist ein Kollege der zufällig sehr gut mit Daten umgehen kann.

DATUM: ${datum}
BISHERIGER VERLAUF:
${verlauf}

NEUE NACHRICHT von ${currentUser?.name || "Mitarbeiter"} (${rolle}):
"${userText}"

REGELN:
- Reagiere natürlich und menschlich – wie ein Kollege
- Wenn Material/Arbeiten erwähnt: kurz bestätigen was du erfasst hast ("Alright, trage ich ein.")
- Stelle maximal EINE Rückfrage wenn wichtige Info fehlt (Menge? Einbauort? Lieferant?)
- Bei Problemen/Schäden: kurz nachfragen was passiert ist
- Bei Foto: frage was drauf ist falls unklar
- Bei Smalltalk: antworte locker und kurz
- NIEMALS mehr als 2-3 Sätze
- KEINE Aufzählungen, KEINE Formatierung, NUR normaler Text

Antworte jetzt als Sascha:`;

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 150,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      const d = await res.json();
      const antwort = d.content?.[0]?.text?.trim();
      if (!antwort) return;

      // Realistische Verzögerung NACH der Antwort
      await new Promise(r => setTimeout(r, 400 + Math.random() * 400));

      const saschaMsg: ChatNachricht = {
        baustelle_id: bsId,
        datum,
        text: antwort,
        absender: "Sascha",
        absender_rolle: "KI-Assistent",
        typ: "text",
        ki_verarbeitet: true,
      };
      const { data: sNeu } = await supabase.from("chat_nachrichten").insert([saschaMsg]).select().single();
      if (sNeu) {
        const fertig = { ...saschaMsg, id: sNeu.id, created_at: sNeu.created_at };
        setNachrichten((ns: any[]) => [...ns, fertig]);
      }

    } catch (e) {
      console.error("Sascha Fehler:", e);
    } finally {
      setSaschaTyping(false);
    }
  }

  async function sendFoto(files: FileList, capture: boolean) {
    if (!files.length) return;
    setFotoSending(true);
    for (const file of Array.from(files)) {
      // Foto komprimieren
      const url = await komprimieren(file, 800, 0.7);

      // Versuche Storage Upload
      const fileName = `chat/${bsId}/${datum}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { data: uploadData, error } = await supabase.storage.from("dokumente").upload(fileName, file, { upsert: true });
      const fotoUrl = (!error && uploadData)
        ? supabase.storage.from("dokumente").getPublicUrl(fileName).data.publicUrl
        : url;

      const n: ChatNachricht = {
        baustelle_id: bsId,
        datum,
        foto_url: fotoUrl,
        absender: currentUser?.name || "Unbekannt",
        absender_rolle: rolle,
        typ: "foto",
        ki_verarbeitet: false,
      };
      const { data: neu } = await supabase.from("chat_nachrichten").insert([n]).select().single();
      if (neu) setNachrichten((ns: any[]) => [...ns, { ...n, id: neu.id, created_at: neu.created_at }]);
    }
    setFotoSending(false);
  }

  const getRolleColor = (r: string) => {
    if (r === "KI-Assistent") return "#9C27B0";
    if (r === "admin" || r === "chef") return "#7986CB";
    if (r === "polier") return "#BA7517";
    if (r === "baustellen_leitung") return "#E24B4A";
    return ACCENT;
  };

  const getInitials = (name: string) => {
    if (name === "Sascha") return "S";
    return name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();
  };

  const formatTime = (iso?: string) => {
    if (!iso) return "";
    return new Date(iso).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  };

  // Nachrichten nach Absender gruppieren für WhatsApp-ähnliche Darstellung
  const ichBin = currentUser?.name || "";

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>

      {/* Sascha Status */}
      <div style={{ padding: "8px 12px", background: "#f3e5f5", borderRadius: 10, marginBottom: 8, display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#9C27B0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#fff", flexShrink: 0 }}>S</div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#9C27B0" }}>Sascha – KI-Assistent</div>
          <div style={{ fontSize: 10, color: "#aaa" }}>Schreib einfach drauf los – ich erfasse alles automatisch ins Bautagebuch</div>
        </div>
        <button onClick={onKiVerarbeitung} disabled={kiLaeuft}
          style={{ marginLeft: "auto", fontSize: 10, padding: "3px 8px", borderRadius: 6, border: "1px solid #9C27B0", background: "#fff", color: "#9C27B0", cursor: kiLaeuft ? "not-allowed" : "pointer", opacity: kiLaeuft ? 0.6 : 1, flexShrink: 0 }}>
          {kiLaeuft ? "⏳" : "✦ Verarbeiten"}
        </button>
      </div>

      {/* Nachrichten */}
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "8px 0", display: "flex", flexDirection: "column", gap: 4 }}>
        {nachrichten.length === 0 && (
          <div style={{ textAlign: "center", color: "#bbb", padding: 40 }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>💬</div>
            <div style={{ fontSize: 14, marginBottom: 4 }}>Noch keine Nachrichten</div>
            <div style={{ fontSize: 11 }}>Schreib einfach was heute auf der Baustelle passiert ist</div>
          </div>
        )}

        {nachrichten.map((n: ChatNachricht, idx: number) => {
          const ichBinSender = n.absender === ichBin;
          const vorherigerSelberSender = idx > 0 && nachrichten[idx-1].absender === n.absender;

          return (
            <div key={n.id || idx} style={{ display: "flex", flexDirection: ichBinSender ? "row-reverse" : "row", alignItems: "flex-end", gap: 6, padding: "1px 12px" }}>

              {/* Avatar – nur wenn erster von diesem Sender */}
              {!ichBinSender && (
                <div style={{ width: 30, height: 30, borderRadius: "50%", background: vorherigerSelberSender ? "transparent" : n.absender === "Sascha" ? ACCENT : getRolleColor(n.absender_rolle || ""), display: "flex", alignItems: "center", justifyContent: "center", fontSize: n.absender === "Sascha" ? 15 : 11, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
                  {!vorherigerSelberSender && (n.absender === "Sascha" ? "🤖" : getInitials(n.absender))}
                </div>
              )}

              {/* Nachricht Bubble */}
              <div style={{ maxWidth: isMobile ? "75%" : "60%", display: "flex", flexDirection: "column", alignItems: ichBinSender ? "flex-end" : "flex-start" }}>

                {/* Name + Rolle – nur wenn erster von diesem Sender und nicht ich */}
                {!ichBinSender && !vorherigerSelberSender && (
                  <div style={{ fontSize: 10, color: n.absender === "Sascha" ? ACCENT : getRolleColor(n.absender_rolle || ""), fontWeight: 600, marginBottom: 2, marginLeft: 4 }}>
                    {n.absender === "Sascha" ? "✦ Sascha · KI-Assistent" : n.absender}
                    {n.absender_rolle && n.absender !== "Sascha" && <span style={{ fontWeight: 400, color: "#bbb" }}> · {n.absender_rolle}</span>}
                  </div>
                )}

                <div style={{
                  background: ichBinSender ? ACCENT : n.absender === "Sascha" ? "#f3e5f5" : "#fff",
                  color: ichBinSender ? "#fff" : n.absender === "Sascha" ? "#6a1b9a" : "#222",
                  borderRadius: ichBinSender ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                  padding: n.typ === "foto" ? "4px" : "10px 14px",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.10)",
                  maxWidth: "100%",
                  border: n.absender === "Sascha" ? "1px solid #ce93d8" : "none",
                }}>
                  {n.typ === "text" && (
                    <div style={{ fontSize: 13, lineHeight: 1.45, wordBreak: "break-word" }}>{n.text}</div>
                  )}
                  {n.typ === "foto" && n.foto_url && (
                    <img src={n.foto_url} alt="Foto" style={{ maxWidth: 220, maxHeight: 200, borderRadius: 12, display: "block", cursor: "pointer" }}
                      onClick={() => window.open(n.foto_url)} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  )}
                </div>

                {/* Zeit + KI-Status */}
                <div style={{ fontSize: 9, color: "#bbb", marginTop: 2, marginLeft: ichBinSender ? 0 : 4, marginRight: ichBinSender ? 4 : 0, display: "flex", gap: 4, alignItems: "center" }}>
                  {formatTime(n.created_at)}
                  {n.ki_verarbeitet && <span style={{ color: "#9C27B0", fontSize: 9 }}>✦ KI</span>}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={chatEndRef} />

        {/* Sascha tippt... Indikator */}
        {saschaTyping && (
          <div style={{ display: "flex", alignItems: "flex-end", gap: 6, padding: "4px 12px" }}>
            <div style={{ width: 30, height: 30, borderRadius: "50%", background: "linear-gradient(135deg, #4DB6AC, #1D9E75)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}>🤖</div>
            <div style={{ background: "#fff", borderRadius: "18px 18px 18px 4px", padding: "10px 14px", boxShadow: "0 1px 4px rgba(0,0,0,0.10)" }}>
              <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                {[0,1,2].map(i => (
                  <div key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: ACCENT, opacity: 0.7,
                    animation: `bounce 1.2s ease-in-out ${i*0.2}s infinite` }} />
                ))}
              </div>
            </div>
            <style>{`@keyframes bounce { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-5px)} }`}</style>
          </div>
        )}
      </div>

      {/* Eingabe */}
      <div style={{ flexShrink: 0, padding: "8px 12px", background: "#fff", borderTop: "1px solid #f0f0f0", display: "flex", gap: 8, alignItems: "flex-end" }}>

        {/* Foto Buttons */}
        <label style={{ padding: "10px", borderRadius: "50%", background: "#f0f4f3", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, opacity: fotoSending ? 0.6 : 1 }}>
          📸
          <input type="file" accept="image/*" capture="environment" multiple style={{ display: "none" }} onChange={e => e.target.files && sendFoto(e.target.files, true)} />
        </label>
        <label style={{ padding: "10px", borderRadius: "50%", background: "#f0f4f3", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, opacity: fotoSending ? 0.6 : 1 }}>
          🖼
          <input type="file" accept="image/*" multiple style={{ display: "none" }} onChange={e => e.target.files && sendFoto(e.target.files, false)} />
        </label>

        {/* Texteingabe */}
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendText(); } }}
          placeholder="Nachricht schreiben..."
          rows={1}
          style={{ flex: 1, padding: "10px 14px", borderRadius: 22, border: "1.5px solid #e8eaed", background: "#f8f8f8", fontSize: 13, resize: "none", outline: "none", fontFamily: "system-ui", maxHeight: 100, overflowY: "auto", lineHeight: 1.4 }}
        />

        {/* Senden Button */}
        <button onClick={sendText} disabled={!text.trim() || sending}
          style={{ width: 42, height: 42, borderRadius: "50%", border: "none", background: text.trim() ? ACCENT : "#e8eaed", cursor: text.trim() ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0, transition: "background 0.2s" }}>
          ➤
        </button>
      </div>
    </div>
  );
}

// ── Tageslog Formular ──────────────────────────────────────────────────────────
function TageslogForm({ eintrag, setEintrag, data, onSave, onWetter, wetterLoad, isMobile }: any) {
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    await onSave(eintrag);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const toggleMA = (id: number) => setEintrag((e: any) => ({
    ...e,
    mitarbeiter_anwesend: e.mitarbeiter_anwesend.includes(id)
      ? e.mitarbeiter_anwesend.filter((i: number) => i !== id)
      : [...e.mitarbeiter_anwesend, id],
  }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ ...C.card, padding: "14px 16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#222" }}>🌤 Wetterdaten</span>
          <button onClick={onWetter} disabled={wetterLoad} style={{ ...C.btnS, fontSize: 11, padding: "5px 12px", opacity: wetterLoad ? 0.6 : 1 }}>
            {wetterLoad ? "Lädt..." : "⟳ Auto-laden"}
          </button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr 1fr 1fr", gap: 10 }}>
          {[["Wetter", "wetter", "Bewölkt"], ["Temperatur", "temperatur", "18°C"], ["Wind", "wind", "15 km/h"], ["Niederschlag", "niederschlag", "0 mm"]].map(([label, key, ph]) => (
            <div key={key}>
              <label style={C.lbl}>{label}</label>
              <input style={C.inp} value={(eintrag as any)[key] || ""} placeholder={ph} onChange={e => setEintrag((x: any) => ({ ...x, [key]: e.target.value }))} />
            </div>
          ))}
        </div>
      </div>

      <div style={{ ...C.card, padding: "14px 16px" }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#222", marginBottom: 12 }}>⏰ Arbeitszeiten</div>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10 }}>
          <div><label style={C.lbl}>Arbeitsbeginn</label><input type="time" style={C.inp} value={eintrag.arbeitsbeginn || ""} onChange={e => setEintrag((x: any) => ({ ...x, arbeitsbeginn: e.target.value }))} /></div>
          <div><label style={C.lbl}>Arbeitsende</label><input type="time" style={C.inp} value={eintrag.arbeitsende || ""} onChange={e => setEintrag((x: any) => ({ ...x, arbeitsende: e.target.value }))} /></div>
        </div>
      </div>

      <div style={{ ...C.card, padding: "14px 16px" }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#222", marginBottom: 10 }}>👷 Anwesende Mitarbeiter ({eintrag.mitarbeiter_anwesend.length})</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {data.mitarbeiter.filter((m: any) => m.status !== "krank" && m.status !== "Urlaub" && m.status !== "gekuendigt").map((m: any) => {
            const sel = eintrag.mitarbeiter_anwesend.includes(m.id);
            return (
              <button key={m.id} onClick={() => toggleMA(m.id)}
                style={{ padding: "7px 12px", borderRadius: 10, border: "1.5px solid " + (sel ? ACCENT : "#eee"), background: sel ? "#e8f5f3" : "#fff", cursor: "pointer", fontSize: 12, color: sel ? ACCENT : "#555", fontWeight: sel ? 600 : 400 }}>
                {m.name}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ ...C.card, padding: "14px 16px" }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#222", marginBottom: 10 }}>📝 Notizen</div>
        <label style={C.lbl}>Tagesnotizen</label>
        <textarea rows={3} style={{ ...C.inp, resize: "vertical" as any, fontFamily: "system-ui" }} value={eintrag.notizen || ""} placeholder="Was wurde heute gemacht..." onChange={e => setEintrag((x: any) => ({ ...x, notizen: e.target.value }))} />
        <label style={C.lbl}>Besonderheiten / Abweichungen</label>
        <textarea rows={2} style={{ ...C.inp, resize: "vertical" as any, fontFamily: "system-ui", borderColor: eintrag.besonderheiten ? "#BA7517" : "#e8eaed" }} value={eintrag.besonderheiten || ""} placeholder="z.B. Mehrverbrauch, Schäden..." onChange={e => setEintrag((x: any) => ({ ...x, besonderheiten: e.target.value }))} />
      </div>

      <button onClick={handleSave} style={{ ...C.btnP, width: "100%", padding: "13px", fontSize: 14, background: saved ? "#1D9E75" : ACCENT }}>
        {saved ? "✓ Gespeichert!" : "Tageslog speichern"}
      </button>
    </div>
  );
}

// ── Material Karte ─────────────────────────────────────────────────────────────
function MaterialKarte({ m, fotos, isMobile, onEdit, onDelete, onFotoUpload, onFotoDelete, onLightbox, uploading }: any) {
  const [showFotos, setShowFotos] = useState(false);
  const matFotos = fotos.filter((f: any) => f.typ === "Material" || f.typ === "Lieferschein" || f.typ === "Einbauort");
  const isKI = m.erstellt_von === "KI-Assistent";

  return (
    <div style={{ ...C.card, marginBottom: 10, padding: "14px 16px", borderLeft: isKI ? "3px solid #9C27B0" : "none" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#222" }}>{m.materialart}</div>
            {isKI && <span style={{ fontSize: 9, background: "#f3e5f5", color: "#9C27B0", padding: "1px 5px", borderRadius: 4, fontWeight: 600 }}>✦ KI</span>}
          </div>
          <div style={{ fontSize: 12, color: ACCENT, marginTop: 2 }}>{m.menge} {m.einheit}</div>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 8, background: m.status === "verbaut" ? "#e8f5f3" : m.status === "gelagert" ? "#fff3e0" : "#f0f4f3", color: m.status === "verbaut" ? ACCENT : m.status === "gelagert" ? "#BA7517" : "#888", fontWeight: 600 }}>{m.status}</span>
          <button onClick={onEdit} style={{ padding: "3px 8px", borderRadius: 6, border: "1px solid #eee", background: "#fff", cursor: "pointer", fontSize: 11, color: "#555" }}>✎</button>
          <button onClick={onDelete} style={{ padding: "3px 8px", borderRadius: 6, border: "none", background: "#E24B4A18", cursor: "pointer", fontSize: 11, color: "#E24B4A" }}>✕</button>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr 1fr 1fr", gap: 8, fontSize: 11, color: "#666", marginBottom: 8 }}>
        {m.einbauort       && <div><span style={{ color: "#aaa" }}>Einbauort: </span>{m.einbauort}</div>}
        {m.lv_position     && <div><span style={{ color: "#aaa" }}>LV-Pos: </span>{m.lv_position}</div>}
        {m.lieferant       && <div><span style={{ color: "#aaa" }}>Lieferant: </span>{m.lieferant}</div>}
        {m.lieferschein_nr && <div><span style={{ color: "#aaa" }}>LS-Nr: </span>{m.lieferschein_nr}</div>}
      </div>
      {m.besonderheiten && <div style={{ marginBottom: 8, padding: "6px 10px", background: "#fff8e1", borderRadius: 8, fontSize: 11, color: "#BA7517" }}>⚠ {m.besonderheiten}</div>}
      {m.lieferschein_foto && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 10, color: "#aaa", marginBottom: 4 }}>Lieferschein:</div>
          <img src={m.lieferschein_foto} alt="Lieferschein" style={{ height: 70, borderRadius: 6, border: "1px solid #eee", cursor: "pointer" }} onClick={() => onLightbox({ url: m.lieferschein_foto, typ: "Lieferschein", erstellt_von: m.erstellt_von })} />
        </div>
      )}
      <div style={{ borderTop: "1px solid #f5f5f5", paddingTop: 10, marginTop: 4 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <button onClick={() => setShowFotos(s => !s)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: ACCENT, fontWeight: 500, padding: 0 }}>
            📷 Fotos ({matFotos.length}) {showFotos ? "▲" : "▼"}
          </button>
          <div style={{ display: "flex", gap: 6 }}>
            <label style={{ padding: "4px 10px", borderRadius: 8, border: "1.5px solid " + ACCENT, background: "#e8f5f3", color: ACCENT, cursor: "pointer", fontSize: 11, fontWeight: 600, opacity: uploading ? 0.6 : 1 }}>
              📸 <input type="file" accept="image/*" capture="environment" multiple style={{ display: "none" }} onChange={e => e.target.files && onFotoUpload(e.target.files, "Material")} />
            </label>
            <label style={{ padding: "4px 10px", borderRadius: 8, border: "1.5px solid #eee", background: "#fff", color: "#555", cursor: "pointer", fontSize: 11, opacity: uploading ? 0.6 : 1 }}>
              🖼 <input type="file" accept="image/*" multiple style={{ display: "none" }} onChange={e => e.target.files && onFotoUpload(e.target.files, "Material")} />
            </label>
          </div>
        </div>
        {showFotos && (
          <div style={{ marginTop: 10 }}>
            {matFotos.length === 0 ? (
              <div style={{ fontSize: 11, color: "#bbb", textAlign: "center", padding: "12px 0" }}>Noch keine Fotos</div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr 1fr" : "1fr 1fr 1fr 1fr 1fr", gap: 6 }}>
                {matFotos.map((f: any) => (
                  <div key={f.id} style={{ position: "relative", borderRadius: 8, overflow: "hidden", border: "1px solid #eee" }}>
                    <img src={f.url} alt={f.typ} style={{ width: "100%", height: 80, objectFit: "cover", display: "block", cursor: "pointer" }} onClick={() => onLightbox(f)} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                    <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "rgba(0,0,0,0.5)", padding: "2px 4px" }}>
                      <div style={{ fontSize: 9, color: "#fff" }}>{f.typ}</div>
                    </div>
                    <button onClick={() => onFotoDelete(f.id)} style={{ position: "absolute", top: 3, right: 3, background: "rgba(0,0,0,0.55)", border: "none", borderRadius: "50%", width: 18, height: 18, cursor: "pointer", color: "#fff", fontSize: 9, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Material Formular ──────────────────────────────────────────────────────────
function MaterialFormular({ material, isMobile, onSave, onClose }: any) {
  const [f, setF] = useState<Material>({ ...material });

  async function lsFotoHochladen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const maxSize = 600;
        let w = img.width; let h = img.height;
        if (w > maxSize) { h = h * maxSize / w; w = maxSize; }
        canvas.width = w; canvas.height = h;
        canvas.getContext("2d")?.drawImage(img, 0, 0, w, h);
        setF(x => ({ ...x, lieferschein_foto: canvas.toDataURL("image/jpeg", 0.6) }));
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: isMobile ? "flex-end" : "center", justifyContent: "center", zIndex: 9999 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ ...C.card, width: isMobile ? "100%" : "min(580px,95vw)", maxHeight: isMobile ? "92vh" : "90vh", overflowY: "auto", borderRadius: isMobile ? "20px 20px 0 0" : 16, padding: isMobile ? "20px 16px 32px" : 24, margin: 0 }}>
        {isMobile && <div style={{ width: 40, height: 4, background: "#ddd", borderRadius: 2, margin: "0 auto 16px" }} />}
        <div style={{ fontSize: 16, fontWeight: 700, color: "#222", marginBottom: 16, paddingBottom: 12, borderBottom: "1px solid #f5f5f5" }}>
          {material.id ? "Material bearbeiten" : "Material erfassen"}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10 }}>
          <div><label style={C.lbl}>Materialart *</label><input style={C.inp} value={f.materialart} onChange={e => setF(x => ({ ...x, materialart: e.target.value }))} placeholder="z.B. Beton C25/30" /></div>
          <div><label style={C.lbl}>Status</label><select style={C.inp} value={f.status} onChange={e => setF(x => ({ ...x, status: e.target.value }))}>{MATERIAL_STATUS.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div><label style={C.lbl}>Menge</label><input type="number" style={C.inp} value={f.menge || ""} onChange={e => setF(x => ({ ...x, menge: parseFloat(e.target.value) }))} /></div>
          <div><label style={C.lbl}>Einheit</label><select style={C.inp} value={f.einheit || ""} onChange={e => setF(x => ({ ...x, einheit: e.target.value }))}><option value="">-- wählen --</option>{EINHEITEN.map(e => <option key={e} value={e}>{e}</option>)}</select></div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10 }}>
          <div><label style={C.lbl}>Einbauort</label><input style={C.inp} value={f.einbauort || ""} onChange={e => setF(x => ({ ...x, einbauort: e.target.value }))} placeholder="z.B. Schacht 3" /></div>
          <div><label style={C.lbl}>LV-Position</label><input style={C.inp} value={f.lv_position || ""} onChange={e => setF(x => ({ ...x, lv_position: e.target.value }))} placeholder="z.B. 3.2.1" /></div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10 }}>
          <div><label style={C.lbl}>Lieferant</label><input style={C.inp} value={f.lieferant || ""} onChange={e => setF(x => ({ ...x, lieferant: e.target.value }))} /></div>
          <div><label style={C.lbl}>Lieferschein-Nr.</label><input style={C.inp} value={f.lieferschein_nr || ""} onChange={e => setF(x => ({ ...x, lieferschein_nr: e.target.value }))} /></div>
        </div>
        <div style={{ marginBottom: 8 }}>
          <label style={C.lbl}>Lieferschein Foto</label>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <label style={{ ...C.btnS, cursor: "pointer", fontSize: 12 }}>📷 Foto<input type="file" accept="image/*" style={{ display: "none" }} onChange={lsFotoHochladen} /></label>
            {f.lieferschein_foto && <img src={f.lieferschein_foto} alt="LS" style={{ height: 48, borderRadius: 6, border: "1px solid #eee" }} />}
          </div>
        </div>
        <div><label style={C.lbl}>Besonderheiten</label><textarea rows={2} style={{ ...C.inp, resize: "vertical" as any, fontFamily: "system-ui" }} value={f.besonderheiten || ""} placeholder="z.B. Mehrverbrauch..." onChange={e => setF(x => ({ ...x, besonderheiten: e.target.value }))} /></div>
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button style={{ ...C.btnS, flex: 1 }} onClick={onClose}>Abbrechen</button>
          <button style={{ ...C.btnP, flex: 1, opacity: !f.materialart ? 0.5 : 1 }} onClick={() => { if (f.materialart) onSave(f); }}>Speichern</button>
        </div>
      </div>
    </div>
  );
}

// ── Übersicht ──────────────────────────────────────────────────────────────────
function UebersichtTab({ bsId }: any) {
  const [eintraege,   setEintraege]   = useState<any[]>([]);
  const [materialien, setMaterialien] = useState<any[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [filterVon,   setFilterVon]   = useState("");
  const [filterBis,   setFilterBis]   = useState("");

  useEffect(() => {
    async function load() {
      const { data: e } = await supabase.from("bautagebuch_eintraege").select("*").eq("baustelle_id", bsId).order("datum", { ascending: false });
      const { data: m } = await supabase.from("bautagebuch_material").select("*").eq("baustelle_id", bsId).order("datum", { ascending: false });
      setEintraege(e || []); setMaterialien(m || []); setLoading(false);
    }
    load();
  }, [bsId]);

  const gefiltertE = eintraege.filter(e => (!filterVon || e.datum >= filterVon) && (!filterBis || e.datum <= filterBis));
  const gefiltertM = materialien.filter(m => (!filterVon || m.datum >= filterVon) && (!filterBis || m.datum <= filterBis));

  if (loading) return <div style={{ textAlign: "center", color: "#bbb", padding: 32 }}>Lädt...</div>;

  return (
    <div>
      <div style={{ ...C.card, padding: "12px 14px", marginBottom: 14 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div><label style={C.lbl}>Von</label><input type="date" style={{ ...C.inp, marginBottom: 0, width: "auto" }} value={filterVon} onChange={e => setFilterVon(e.target.value)} /></div>
          <div><label style={C.lbl}>Bis</label><input type="date" style={{ ...C.inp, marginBottom: 0, width: "auto" }} value={filterBis} onChange={e => setFilterBis(e.target.value)} /></div>
          <button onClick={() => { setFilterVon(""); setFilterBis(""); }} style={{ ...C.btnS, fontSize: 12 }}>Reset</button>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 14 }}>
        {[["Einträge", gefiltertE.length, "📝"], ["Materialien", gefiltertM.length, "📦"], ["Besonderheiten", gefiltertE.filter(e => e.besonderheiten).length, "⚠"]].map(([label, val, icon]) => (
          <div key={label as string} style={{ ...C.card, textAlign: "center", padding: "14px 10px" }}>
            <div style={{ fontSize: 20 }}>{icon}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: ACCENT }}>{val}</div>
            <div style={{ fontSize: 11, color: "#aaa" }}>{label}</div>
          </div>
        ))}
      </div>
      <div style={{ ...C.card, padding: "14px 16px" }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#222", marginBottom: 12 }}>Tageseinträge</div>
        {gefiltertE.length === 0 && <div style={{ fontSize: 12, color: "#bbb", textAlign: "center", padding: 16 }}>Keine Einträge</div>}
        {gefiltertE.map(e => (
          <div key={e.id} style={{ padding: "10px 0", borderBottom: "1px solid #f5f5f5" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#222" }}>{new Date(e.datum).toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit" })}</span>
              <span style={{ fontSize: 11, color: "#aaa" }}>{e.erstellt_von}</span>
            </div>
            <div style={{ display: "flex", gap: 10, fontSize: 11, color: "#888", flexWrap: "wrap" }}>
              {e.wetter && <span>🌤 {e.wetter} {e.temperatur}</span>}
              {e.arbeitsbeginn && <span>⏰ {e.arbeitsbeginn}–{e.arbeitsende}</span>}
              {e.notizen && <span style={{ color: "#555" }}>{e.notizen.slice(0, 60)}{e.notizen.length > 60 ? "..." : ""}</span>}
            </div>
            {e.besonderheiten && <div style={{ marginTop: 4, fontSize: 11, color: "#BA7517" }}>⚠ {e.besonderheiten}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
