import { useState, useEffect, useRef } from "react";
import { C, ACCENT } from "../lib/constants";
import { supabase } from "../lib/supabase";

const EINHEITEN = ["m³", "m²", "m", "t", "kg", "Stück", "l", "to", "Palette"];
const MATERIAL_STATUS = ["geliefert", "verbaut", "gelagert"];
const FOTO_TYPEN = ["allgemein", "Material", "Lieferschein", "Einbauort", "Schaden", "Abnahme"];

// ── Wetter-Übersetzung ─────────────────────────────────────────────────────────
const WETTER_DE: Record<string, string> = {
  "Sunny": "Sonnig", "Clear": "Klar", "Partly cloudy": "Teilweise bewölkt",
  "Cloudy": "Bewölkt", "Overcast": "Bedeckt", "Mist": "Neblig",
  "Patchy rain possible": "Leichter Regen möglich", "Patchy snow possible": "Leichter Schnee möglich",
  "Blowing snow": "Schneetreiben", "Blizzard": "Schneesturm", "Fog": "Nebel",
  "Freezing fog": "Gefrierender Nebel", "Patchy light drizzle": "Leichter Nieselregen",
  "Light drizzle": "Nieselregen", "Freezing drizzle": "Gefrierender Nieselregen",
  "Heavy freezing drizzle": "Starker gefrierender Nieselregen",
  "Patchy light rain": "Leichter Regen", "Light rain": "Leichter Regen",
  "Moderate rain at times": "Mäßiger Regen", "Moderate rain": "Mäßiger Regen",
  "Heavy rain at times": "Starker Regen", "Heavy rain": "Starker Regen",
  "Light freezing rain": "Leichter Gefrierregen", "Moderate or heavy freezing rain": "Starker Gefrierregen",
  "Light sleet": "Leichter Graupel", "Moderate or heavy sleet": "Starker Graupel",
  "Patchy light snow": "Leichter Schnee", "Light snow": "Leichter Schnee",
  "Patchy moderate snow": "Mäßiger Schnee", "Moderate snow": "Mäßiger Schnee",
  "Patchy heavy snow": "Starker Schnee", "Heavy snow": "Starker Schnee",
  "Ice pellets": "Eisregen", "Light rain shower": "Leichter Regenschauer",
  "Moderate or heavy rain shower": "Starker Regenschauer", "Torrential rain shower": "Starkregen",
  "Light sleet showers": "Leichter Graupelschauer", "Moderate or heavy sleet showers": "Starker Graupelschauer",
  "Light snow showers": "Leichter Schneeschauer", "Moderate or heavy snow showers": "Starker Schneeschauer",
  "Light showers of ice pellets": "Leichter Eisregen", "Moderate or heavy showers of ice pellets": "Starker Eisregen",
  "Patchy light rain with thunder": "Leichter Regen mit Gewitter",
  "Moderate or heavy rain with thunder": "Gewitter mit Regen",
  "Patchy light snow with thunder": "Leichter Schnee mit Gewitter",
  "Moderate or heavy snow with thunder": "Gewitter mit Schnee",
  "Thunder": "Gewitter", "Thunderstorm": "Gewitter",
};

function wetterDE(englisch: string): string {
  return WETTER_DE[englisch] || englisch;
}

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

export function BautagebuchTab({ data, currentUser, rolle }: any) {
  const [selectedBS,  setSelectedBS]  = useState<number|null>(null);
  const [datum,       setDatum]       = useState(new Date().toISOString().split("T")[0]);
  const [eintrag,     setEintrag]     = useState<Eintrag|null>(null);
  const [materialien, setMaterialien] = useState<Material[]>([]);
  const [fotos,       setFotos]       = useState<Foto[]>([]);
  const [loading,     setLoading]     = useState(false);
  const [activeTab,   setActiveTab]   = useState<"tageslog"|"material"|"fotos"|"uebersicht">("tageslog");
  const [showMatForm, setShowMatForm] = useState(false);
  const [editMat,     setEditMat]     = useState<Material|null>(null);
  const [wetterLoad,  setWetterLoad]  = useState(false);

  const isMobile = window.innerWidth < 768;

  const meineBS = rolle === "baustellen_leitung"
    ? data.baustellen.filter((b: any) => b.mitarbeiter?.includes(currentUser?.id))
    : data.baustellen.filter((b: any) => b.status !== "abgeschlossen");

  useEffect(() => {
    if (selectedBS) loadEintrag();
  }, [selectedBS, datum]);

  async function loadEintrag() {
    if (!selectedBS) return;
    setLoading(true);

    // Tageseintrag laden
    const { data: e } = await supabase.from("bautagebuch_eintraege")
      .select("*").eq("baustelle_id", selectedBS).eq("datum", datum).maybeSingle();

    if (e) {
      setEintrag({
        ...e,
        mitarbeiter_anwesend: Array.isArray(e.mitarbeiter_anwesend) ? e.mitarbeiter_anwesend.map(Number) : [],
        geraete: Array.isArray(e.geraete) ? e.geraete : [],
      });
    } else {
      setEintrag({ baustelle_id: selectedBS, datum, mitarbeiter_anwesend: [], geraete: [] });
    }

    // Material laden
    const { data: m } = await supabase.from("bautagebuch_material")
      .select("*").eq("baustelle_id", selectedBS).eq("datum", datum).order("id");
    setMaterialien(m || []);

    // Fotos laden
    const { data: f } = await supabase.from("bautagebuch_fotos")
      .select("*").eq("baustelle_id", selectedBS).eq("datum", datum).order("id");
    setFotos(f || []);

    setLoading(false);
  }

  async function saveEintrag(e: Eintrag) {
    const p = { ...e, erstellt_von: currentUser?.name || "" };
    if (e.id) {
      await supabase.from("bautagebuch_eintraege").update(p).eq("id", e.id);
      setEintrag(p);
    } else {
      const { data: neu, error } = await supabase.from("bautagebuch_eintraege").insert([p]).select().single();
      if (!error && neu) setEintrag({ ...p, id: neu.id });
    }
  }

  // Wetter laden mit deutscher Übersetzung
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
        const beschreibungEN = w.weatherDesc?.[0]?.value || "";
        const updated = {
          ...eintrag,
          temperatur: w.temp_C + "°C",
          wetter: wetterDE(beschreibungEN),
          wind: w.windspeedKmph + " km/h",
          niederschlag: w.precipMM + " mm",
        };
        setEintrag(updated);
        await saveEintrag(updated);
      }
    } catch {
      if (eintrag) setEintrag({ ...eintrag, wetter: "Nicht abrufbar" });
    }
    setWetterLoad(false);
  }

  // Material speichern – mit korrekten Pflichtfeldern
  async function saveMaterial(m: Material) {
    const p: any = {
      baustelle_id: selectedBS!,
      datum,
      materialart: m.materialart,
      status: m.status || "geliefert",
      erstellt_von: currentUser?.name || "",
    };
    // Optionale Felder nur wenn befüllt
    if (eintrag?.id) p.eintrag_id = eintrag.id;
    if (m.menge !== undefined && m.menge !== null) p.menge = m.menge;
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
      else if (error) console.error("Material Fehler:", error);
    }
    setShowMatForm(false);
    setEditMat(null);
  }

  async function deleteMaterial(id: number) {
    await supabase.from("bautagebuch_material").delete().eq("id", id);
    setMaterialien(ms => ms.filter(m => m.id !== id));
  }

  // Foto hochladen – in Supabase Storage statt Base64
  async function fotoHochladen(e: React.ChangeEvent<HTMLInputElement>, typ: string) {
    const file = e.target.files?.[0];
    if (!file || !selectedBS) return;

    // Sicherstelle dass Eintrag existiert
    let eintragsId = eintrag?.id;
    if (!eintragsId && eintrag) {
      const { data: neu } = await supabase.from("bautagebuch_eintraege").insert([{
        ...eintrag, erstellt_von: currentUser?.name || ""
      }]).select().single();
      if (neu) { setEintrag({ ...eintrag, id: neu.id }); eintragsId = neu.id; }
    }

    // Versuche Supabase Storage Upload
    const fileName = `${selectedBS}/${datum}/${Date.now()}_${file.name}`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("dokumente")
      .upload(fileName, file, { upsert: true });

    let url = "";
    if (!uploadError && uploadData) {
      // Public URL holen
      const { data: urlData } = supabase.storage.from("dokumente").getPublicUrl(fileName);
      url = urlData.publicUrl;
    } else {
      // Fallback: Base64 (nur für kleine Bilder)
      url = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (ev) => {
          // Bild komprimieren
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement("canvas");
            const maxSize = 800;
            let w = img.width; let h = img.height;
            if (w > maxSize) { h = h * maxSize / w; w = maxSize; }
            if (h > maxSize) { w = w * maxSize / h; h = maxSize; }
            canvas.width = w; canvas.height = h;
            canvas.getContext("2d")?.drawImage(img, 0, 0, w, h);
            resolve(canvas.toDataURL("image/jpeg", 0.6));
          };
          img.src = ev.target?.result as string;
        };
        reader.readAsDataURL(file);
      });
    }

    if (!url) return;

    const foto: any = {
      baustelle_id: selectedBS,
      datum,
      url,
      typ,
      erstellt_von: currentUser?.name || "",
    };
    if (eintragsId) foto.eintrag_id = eintragsId;

    const { data: neu, error } = await supabase.from("bautagebuch_fotos").insert([foto]).select().single();
    if (!error && neu) setFotos(fs => [...fs, { ...foto, id: neu.id }]);
    else if (error) console.error("Foto Fehler:", error);
  }

  async function deleteFoto(id: number) {
    await supabase.from("bautagebuch_fotos").delete().eq("id", id);
    setFotos(fs => fs.filter(f => f.id !== id));
  }

  // Excel Export
  async function exportExcel() {
    if (!selectedBS) return;
    const { data: alleEintraege } = await supabase.from("bautagebuch_eintraege").select("*").eq("baustelle_id", selectedBS).order("datum");
    const { data: allesMaterial } = await supabase.from("bautagebuch_material").select("*").eq("baustelle_id", selectedBS).order("datum");
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
    ];
    const csvContent = "\uFEFF" + csvRows.map(r => r.map(c => `"${(c || "").toString().replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `Bautagebuch_${bs?.name}_${new Date().toISOString().split("T")[0]}.csv`;
    a.click(); URL.revokeObjectURL(url);
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
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={() => { setSelectedBS(null); setEintrag(null); setMaterialien([]); setFotos([]); }}
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
          <button onClick={exportExcel} style={{ ...C.btnS, display: "flex", alignItems: "center", gap: 5 }}>
            📊 Export
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div style={{ display: "flex", gap: 4, marginBottom: 16, background: "#f0f4f3", borderRadius: 12, padding: 4, overflowX: "auto" }}>
        {[
          { key: "tageslog",   label: "📝 Tageslog" },
          { key: "material",   label: `📦 Material (${materialien.length})` },
          { key: "fotos",      label: `📷 Fotos (${fotos.length})` },
          { key: "uebersicht", label: "📊 Übersicht" },
        ].map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key as any)}
            style={{ flex: "0 0 auto", padding: "8px 16px", borderRadius: 8, border: "none", background: activeTab === t.key ? "#fff" : "transparent", cursor: "pointer", fontSize: 12, fontWeight: activeTab === t.key ? 600 : 400, color: activeTab === t.key ? ACCENT : "#888", boxShadow: activeTab === t.key ? "0 1px 4px rgba(0,0,0,0.08)" : "none" }}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? <div style={{ textAlign: "center", color: "#bbb", padding: 32 }}>Lädt...</div> : (
        <>
          {/* ── TAGESLOG ─────────────────────────────────────────────────── */}
          {activeTab === "tageslog" && eintrag && (
            <TageslogForm
              eintrag={eintrag}
              setEintrag={setEintrag}
              data={data}
              onSave={saveEintrag}
              onWetter={wetterLaden}
              wetterLoad={wetterLoad}
              isMobile={isMobile}
            />
          )}

          {/* ── MATERIAL ─────────────────────────────────────────────────── */}
          {activeTab === "material" && (
            <div>
              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
                <button style={{ ...C.btnP }}
                  onClick={() => {
                    setEditMat({ baustelle_id: selectedBS!, datum, materialart: "", status: "geliefert" } as Material);
                    setShowMatForm(true);
                  }}>
                  + Material erfassen
                </button>
              </div>

              {materialien.length === 0 && (
                <div style={{ ...C.card, textAlign: "center", padding: 32, color: "#bbb" }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>📦</div>
                  Noch kein Material für heute erfasst
                </div>
              )}

              {materialien.map(m => (
                <div key={m.id} style={{ ...C.card, marginBottom: 10, padding: "14px 16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#222" }}>{m.materialart}</div>
                      <div style={{ fontSize: 12, color: ACCENT, marginTop: 2 }}>{m.menge} {m.einheit}</div>
                    </div>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 8, background: m.status === "verbaut" ? "#e8f5f3" : m.status === "gelagert" ? "#fff3e0" : "#f0f4f3", color: m.status === "verbaut" ? ACCENT : m.status === "gelagert" ? "#BA7517" : "#888", fontWeight: 600 }}>
                        {m.status}
                      </span>
                      <button onClick={() => { setEditMat(m); setShowMatForm(true); }} style={{ padding: "3px 8px", borderRadius: 6, border: "1px solid #eee", background: "#fff", cursor: "pointer", fontSize: 11, color: "#555" }}>✎</button>
                      <button onClick={() => deleteMaterial(m.id!)} style={{ padding: "3px 8px", borderRadius: 6, border: "none", background: "#E24B4A18", cursor: "pointer", fontSize: 11, color: "#E24B4A" }}>✕</button>
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr 1fr 1fr", gap: 8, fontSize: 11, color: "#666" }}>
                    {m.einbauort    && <div><span style={{ color: "#aaa" }}>Einbauort: </span>{m.einbauort}</div>}
                    {m.lv_position  && <div><span style={{ color: "#aaa" }}>LV-Pos: </span>{m.lv_position}</div>}
                    {m.lieferant    && <div><span style={{ color: "#aaa" }}>Lieferant: </span>{m.lieferant}</div>}
                    {m.lieferschein_nr && <div><span style={{ color: "#aaa" }}>LS-Nr: </span>{m.lieferschein_nr}</div>}
                  </div>
                  {m.besonderheiten && <div style={{ marginTop: 6, padding: "6px 10px", background: "#fff8e1", borderRadius: 8, fontSize: 11, color: "#BA7517" }}>⚠ {m.besonderheiten}</div>}
                  {m.lieferschein_foto && (
                    <img src={m.lieferschein_foto} alt="Lieferschein" style={{ height: 60, borderRadius: 6, border: "1px solid #eee", cursor: "pointer", marginTop: 8 }} onClick={() => window.open(m.lieferschein_foto)} />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ── FOTOS ────────────────────────────────────────────────────── */}
          {activeTab === "fotos" && (
            <div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
                {FOTO_TYPEN.map(typ => (
                  <label key={typ} style={{ padding: "8px 14px", borderRadius: 10, border: "1.5px solid #e8eaed", background: "#fff", cursor: "pointer", fontSize: 12, color: "#555", display: "flex", alignItems: "center", gap: 5 }}>
                    📷 {typ}
                    <input type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={e => fotoHochladen(e, typ)} />
                  </label>
                ))}
              </div>

              {fotos.length === 0 && (
                <div style={{ ...C.card, textAlign: "center", padding: 32, color: "#bbb" }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>📷</div>
                  Noch keine Fotos für heute
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr 1fr 1fr", gap: 10 }}>
                {fotos.map(f => (
                  <div key={f.id} style={{ borderRadius: 10, overflow: "hidden", border: "1px solid #eee", position: "relative" }}>
                    <img src={f.url} alt={f.beschreibung} style={{ width: "100%", height: 140, objectFit: "cover", display: "block", cursor: "pointer" }} onClick={() => window.open(f.url)} />
                    <div style={{ padding: "6px 8px", background: "#fff" }}>
                      <div style={{ fontSize: 10, color: ACCENT, fontWeight: 600 }}>{f.typ}</div>
                      {f.beschreibung && <div style={{ fontSize: 10, color: "#888" }}>{f.beschreibung}</div>}
                      <div style={{ fontSize: 9, color: "#bbb" }}>{f.erstellt_von}</div>
                    </div>
                    <button onClick={() => deleteFoto(f.id!)}
                      style={{ position: "absolute", top: 6, right: 6, background: "rgba(0,0,0,0.5)", border: "none", borderRadius: "50%", width: 22, height: 22, cursor: "pointer", color: "#fff", fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── ÜBERSICHT ────────────────────────────────────────────────── */}
          {activeTab === "uebersicht" && (
            <UebersichtTab bsId={selectedBS} data={data} />
          )}
        </>
      )}

      {/* Material Formular Modal */}
      {showMatForm && editMat && (
        <MaterialFormular material={editMat} isMobile={isMobile} onSave={saveMaterial} onClose={() => { setShowMatForm(false); setEditMat(null); }} />
      )}
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

      {/* Wetter */}
      <div style={{ ...C.card, padding: "14px 16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#222" }}>🌤 Wetterdaten</span>
          <button onClick={onWetter} disabled={wetterLoad}
            style={{ ...C.btnS, fontSize: 11, padding: "5px 12px", opacity: wetterLoad ? 0.6 : 1 }}>
            {wetterLoad ? "Lädt..." : "⟳ Auto-laden"}
          </button>
        </div>
        {/* Wetter-Felder: 2x2 auf Mobile, 4 nebeneinander auf Desktop */}
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr 1fr 1fr", gap: 10 }}>
          {[
            ["Wetter", "wetter", "text", "z.B. Bewölkt"],
            ["Temperatur", "temperatur", "text", "z.B. 18°C"],
            ["Wind", "wind", "text", "z.B. 15 km/h"],
            ["Niederschlag", "niederschlag", "text", "z.B. 0 mm"],
          ].map(([label, key, type, ph]) => (
            <div key={key}>
              <label style={C.lbl}>{label}</label>
              <input style={C.inp} type={type} value={(eintrag as any)[key] || ""} placeholder={ph as string}
                onChange={e => setEintrag((x: any) => ({ ...x, [key]: e.target.value }))} />
            </div>
          ))}
        </div>
      </div>

      {/* Arbeitszeiten – auf Mobile untereinander statt nebeneinander */}
      <div style={{ ...C.card, padding: "14px 16px" }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#222", marginBottom: 12 }}>⏰ Arbeitszeiten</div>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10 }}>
          <div>
            <label style={C.lbl}>Arbeitsbeginn</label>
            <input type="time" style={{ ...C.inp, fontSize: isMobile ? 16 : 13 }} value={eintrag.arbeitsbeginn || ""}
              onChange={e => setEintrag((x: any) => ({ ...x, arbeitsbeginn: e.target.value }))} />
          </div>
          <div>
            <label style={C.lbl}>Arbeitsende</label>
            <input type="time" style={{ ...C.inp, fontSize: isMobile ? 16 : 13 }} value={eintrag.arbeitsende || ""}
              onChange={e => setEintrag((x: any) => ({ ...x, arbeitsende: e.target.value }))} />
          </div>
        </div>
      </div>

      {/* Anwesende Mitarbeiter */}
      <div style={{ ...C.card, padding: "14px 16px" }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#222", marginBottom: 10 }}>👷 Anwesende Mitarbeiter ({eintrag.mitarbeiter_anwesend.length})</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {data.mitarbeiter
            .filter((m: any) => m.status !== "krank" && m.status !== "Urlaub" && m.status !== "gekuendigt")
            .map((m: any) => {
              const sel = eintrag.mitarbeiter_anwesend.includes(m.id);
              return (
                <button key={m.id} onClick={() => toggleMA(m.id)}
                  style={{ padding: isMobile ? "8px 12px" : "6px 12px", borderRadius: 10, border: "1.5px solid " + (sel ? ACCENT : "#eee"), background: sel ? "#e8f5f3" : "#fff", cursor: "pointer", fontSize: isMobile ? 13 : 12, color: sel ? ACCENT : "#555", fontWeight: sel ? 600 : 400 }}>
                  {m.name}
                </button>
              );
            })}
        </div>
      </div>

      {/* Notizen + Besonderheiten */}
      <div style={{ ...C.card, padding: "14px 16px" }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#222", marginBottom: 10 }}>📝 Notizen</div>
        <label style={C.lbl}>Tagesnotizen</label>
        <textarea rows={3} style={{ ...C.inp, resize: "vertical" as any, fontFamily: "system-ui" }} value={eintrag.notizen || ""} placeholder="Was wurde heute gemacht..."
          onChange={e => setEintrag((x: any) => ({ ...x, notizen: e.target.value }))} />
        <label style={C.lbl}>Besonderheiten / Abweichungen</label>
        <textarea rows={2} style={{ ...C.inp, resize: "vertical" as any, fontFamily: "system-ui", borderColor: eintrag.besonderheiten ? "#BA7517" : "#e8eaed" }} value={eintrag.besonderheiten || ""} placeholder="z.B. Mehrverbrauch, Schäden, Verzögerungen..."
          onChange={e => setEintrag((x: any) => ({ ...x, besonderheiten: e.target.value }))} />
      </div>

      <button onClick={handleSave}
        style={{ ...C.btnP, width: "100%", padding: "13px", fontSize: 14, background: saved ? "#1D9E75" : ACCENT }}>
        {saved ? "✓ Gespeichert!" : "Tageslog speichern"}
      </button>
    </div>
  );
}

// ── Material Formular ──────────────────────────────────────────────────────────
function MaterialFormular({ material, isMobile, onSave, onClose }: any) {
  const [f, setF] = useState<Material>({ ...material });
  const lsRef = useRef<HTMLInputElement>(null);

  async function lsFotoHochladen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    // Komprimieren
    const url = await new Promise<string>((resolve) => {
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
          resolve(canvas.toDataURL("image/jpeg", 0.5));
        };
        img.src = ev.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
    setF(x => ({ ...x, lieferschein_foto: url }));
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
          <div>
            <label style={C.lbl}>Materialart *</label>
            <input style={C.inp} value={f.materialart} onChange={e => setF(x => ({ ...x, materialart: e.target.value }))} placeholder="z.B. Beton C25/30" />
          </div>
          <div>
            <label style={C.lbl}>Status</label>
            <select style={C.inp} value={f.status} onChange={e => setF(x => ({ ...x, status: e.target.value }))}>
              {MATERIAL_STATUS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr", gap: 10 }}>
          <div>
            <label style={C.lbl}>Menge</label>
            <input type="number" style={C.inp} value={f.menge || ""} onChange={e => setF(x => ({ ...x, menge: parseFloat(e.target.value) }))} placeholder="0" />
          </div>
          <div>
            <label style={C.lbl}>Einheit</label>
            <select style={C.inp} value={f.einheit || ""} onChange={e => setF(x => ({ ...x, einheit: e.target.value }))}>
              <option value="">-- wählen --</option>
              {EINHEITEN.map(e => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10 }}>
          <div>
            <label style={C.lbl}>Einbauort / Bauabschnitt</label>
            <input style={C.inp} value={f.einbauort || ""} onChange={e => setF(x => ({ ...x, einbauort: e.target.value }))} placeholder="z.B. Schacht 3, FGU" />
          </div>
          <div>
            <label style={C.lbl}>LV-Position</label>
            <input style={C.inp} value={f.lv_position || ""} onChange={e => setF(x => ({ ...x, lv_position: e.target.value }))} placeholder="z.B. 3.2.1" />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10 }}>
          <div>
            <label style={C.lbl}>Lieferant</label>
            <input style={C.inp} value={f.lieferant || ""} onChange={e => setF(x => ({ ...x, lieferant: e.target.value }))} placeholder="Firmenname" />
          </div>
          <div>
            <label style={C.lbl}>Lieferschein-Nr.</label>
            <input style={C.inp} value={f.lieferschein_nr || ""} onChange={e => setF(x => ({ ...x, lieferschein_nr: e.target.value }))} placeholder="z.B. LS-2026-001" />
          </div>
        </div>

        <div style={{ marginBottom: 8 }}>
          <label style={C.lbl}>Lieferschein Foto</label>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <label style={{ ...C.btnS, cursor: "pointer", fontSize: 12 }}>
              📷 Foto aufnehmen
              <input ref={lsRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={lsFotoHochladen} />
            </label>
            {f.lieferschein_foto && (
              <img src={f.lieferschein_foto} alt="Lieferschein" style={{ height: 48, borderRadius: 6, border: "1px solid #eee" }} />
            )}
          </div>
        </div>

        <div>
          <label style={C.lbl}>Besonderheiten / Abweichungen</label>
          <textarea rows={2} style={{ ...C.inp, resize: "vertical" as any, fontFamily: "system-ui" }} value={f.besonderheiten || ""} placeholder="z.B. Mehrverbrauch, Schäden..."
            onChange={e => setF(x => ({ ...x, besonderheiten: e.target.value }))} />
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button style={{ ...C.btnS, flex: 1 }} onClick={onClose}>Abbrechen</button>
          <button style={{ ...C.btnP, flex: 1, opacity: !f.materialart ? 0.5 : 1 }}
            onClick={() => { if (f.materialart) onSave(f); }}>Speichern</button>
        </div>
      </div>
    </div>
  );
}

// ── Übersicht Tab ──────────────────────────────────────────────────────────────
function UebersichtTab({ bsId, data }: any) {
  const [eintraege,   setEintraege]   = useState<any[]>([]);
  const [materialien, setMaterialien] = useState<any[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [filterVon,   setFilterVon]   = useState("");
  const [filterBis,   setFilterBis]   = useState("");

  useEffect(() => {
    async function load() {
      const { data: e } = await supabase.from("bautagebuch_eintraege").select("*").eq("baustelle_id", bsId).order("datum", { ascending: false });
      const { data: m } = await supabase.from("bautagebuch_material").select("*").eq("baustelle_id", bsId).order("datum", { ascending: false });
      setEintraege(e || []);
      setMaterialien(m || []);
      setLoading(false);
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
          <button onClick={() => { setFilterVon(""); setFilterBis(""); }} style={{ ...C.btnS, fontSize: 12 }}>Zurücksetzen</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 14 }}>
        {[["Einträge", gefiltertE.length, "📝"], ["Materialien", gefiltertM.length, "📦"], ["Besonderheiten", gefiltertE.filter(e => e.besonderheiten).length, "⚠"]].map(([label, val, icon]) => (
          <div key={label as string} style={{ ...C.card, textAlign: "center", padding: "14px 10px" }}>
            <div style={{ fontSize: 22 }}>{icon}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: ACCENT }}>{val}</div>
            <div style={{ fontSize: 11, color: "#aaa" }}>{label}</div>
          </div>
        ))}
      </div>

      <div style={{ ...C.card, padding: "14px 16px" }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#222", marginBottom: 12 }}>Tageseinträge</div>
        {gefiltertE.length === 0 && <div style={{ fontSize: 12, color: "#bbb", textAlign: "center", padding: 16 }}>Keine Einträge</div>}
        {gefiltertE.map(e => (
          <div key={e.id} style={{ padding: "10px 0", borderBottom: "1px solid #f5f5f5" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
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
