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
  "Patchy rain possible": "Leichter Regen möglich", "Fog": "Nebel",
  "Light rain": "Leichter Regen", "Moderate rain": "Mäßiger Regen",
  "Heavy rain": "Starker Regen", "Light snow": "Leichter Schnee",
  "Moderate snow": "Mäßiger Schnee", "Heavy snow": "Starker Schnee",
  "Thunder": "Gewitter", "Thunderstorm": "Gewitter",
  "Patchy light rain": "Leichter Regen", "Light drizzle": "Nieselregen",
  "Freezing drizzle": "Gefrierender Nieselregen",
  "Blizzard": "Schneesturm", "Ice pellets": "Eisregen",
  "Light rain shower": "Leichter Regenschauer",
  "Moderate or heavy rain shower": "Starker Regenschauer",
  "Patchy light snow": "Leichter Schnee",
  "Patchy moderate snow": "Mäßiger Schnee",
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
  const [fotoUpload,  setFotoUpload]  = useState(false);
  const [selectedTyp, setSelectedTyp] = useState<string|null>(null);
  const [lightbox,    setLightbox]    = useState<Foto|null>(null);

  const isMobile = window.innerWidth < 768;

  const meineBS = rolle === "baustellen_leitung"
    ? data.baustellen.filter((b: any) => b.mitarbeiter?.includes(currentUser?.id))
    : data.baustellen.filter((b: any) => b.status !== "abgeschlossen");

  useEffect(() => { if (selectedBS) loadEintrag(); }, [selectedBS, datum]);

  async function loadEintrag() {
    if (!selectedBS) return;
    setLoading(true);
    const { data: e } = await supabase.from("bautagebuch_eintraege")
      .select("*").eq("baustelle_id", selectedBS).eq("datum", datum).maybeSingle();
    if (e) {
      setEintrag({ ...e, mitarbeiter_anwesend: Array.isArray(e.mitarbeiter_anwesend) ? e.mitarbeiter_anwesend.map(Number) : [], geraete: Array.isArray(e.geraete) ? e.geraete : [] });
    } else {
      setEintrag({ baustelle_id: selectedBS, datum, mitarbeiter_anwesend: [], geraete: [] });
    }
    const { data: m } = await supabase.from("bautagebuch_material").select("*").eq("baustelle_id", selectedBS).eq("datum", datum).order("id");
    setMaterialien(m || []);
    const { data: f } = await supabase.from("bautagebuch_fotos").select("*").eq("baustelle_id", selectedBS).eq("datum", datum).order("id");
    setFotos(f || []);
    setLoading(false);
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

  // Sicherstellen dass Eintrag existiert und ID zurückgeben
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

  // ── Foto Upload – Storage + Fallback ──────────────────────────────────────────
  async function fotosHochladen(files: FileList, typ: string) {
    if (!files.length || !selectedBS) return;
    setFotoUpload(true);

    const eintragsId = await ensureEintrag();

    for (const file of Array.from(files)) {
      let url = "";

      // Versuche Supabase Storage
      const fileName = `bautagebuch/${selectedBS}/${datum}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("dokumente").upload(fileName, file, { upsert: true });

      if (!uploadError && uploadData) {
        const { data: urlData } = supabase.storage.from("dokumente").getPublicUrl(fileName);
        url = urlData.publicUrl;
      } else {
        // Fallback: komprimiertes Base64
        url = await komprimieren(file, 800, 0.7);
      }

      if (!url) continue;

      const foto: any = { baustelle_id: selectedBS, datum, url, typ, erstellt_von: currentUser?.name || "" };
      if (eintragsId) foto.eintrag_id = eintragsId;

      const { data: neu, error } = await supabase.from("bautagebuch_fotos").insert([foto]).select().single();
      if (!error && neu) setFotos(fs => [...fs, { ...foto, id: neu.id }]);
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

  async function exportExcel() {
    if (!selectedBS) return;
    const { data: alleEintraege } = await supabase.from("bautagebuch_eintraege").select("*").eq("baustelle_id", selectedBS).order("datum");
    const { data: allesMaterial } = await supabase.from("bautagebuch_material").select("*").eq("baustelle_id", selectedBS).order("datum");
    const bs = data.baustellen.find((b: any) => b.id === selectedBS);
    const csvRows = [
      ["Digitales Bautagebuch - " + bs?.name], ["Exportiert am: " + new Date().toLocaleDateString("de-DE")], [],
      ["=== TAGESEINTRÄGE ==="],
      ["Datum", "Wetter", "Temperatur", "Wind", "Niederschlag", "Arbeitsbeginn", "Arbeitsende", "Notizen", "Besonderheiten"],
      ...(alleEintraege || []).map((e: any) => [e.datum, e.wetter, e.temperatur, e.wind, e.niederschlag, e.arbeitsbeginn, e.arbeitsende, e.notizen, e.besonderheiten]),
      [], ["=== MATERIAL ==="],
      ["Datum", "Materialart", "Menge", "Einheit", "Einbauort", "LV-Position", "Lieferant", "Lieferschein-Nr", "Status", "Besonderheiten"],
      ...(allesMaterial || []).map((m: any) => [m.datum, m.materialart, m.menge, m.einheit, m.einbauort, m.lv_position, m.lieferant, m.lieferschein_nr, m.status, m.besonderheiten]),
    ];
    const csvContent = "\uFEFF" + csvRows.map(r => r.map(c => `"${(c || "").toString().replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `Bautagebuch_${bs?.name}_${datum}.csv`;
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
          <button onClick={exportExcel} style={C.btnS}>📊 Export</button>
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
                <MaterialKarte
                  key={m.id}
                  m={m}
                  fotos={fotos}
                  isMobile={isMobile}
                  onEdit={() => { setEditMat(m); setShowMatForm(true); }}
                  onDelete={() => deleteMaterial(m.id!)}
                  onFotoUpload={fotosHochladen}
                  onFotoDelete={deleteFoto}
                  onLightbox={setLightbox}
                  uploading={fotoUpload}
                />
              ))}
            </div>
          )}

          {/* ── FOTOS ────────────────────────────────────────────────────── */}
          {activeTab === "fotos" && (
            <div>
              {/* Upload Bereich */}
              <div style={{ ...C.card, marginBottom: 16, padding: "16px" }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#222", marginBottom: 12 }}>📷 Fotos hochladen</div>

                {/* Typ auswählen */}
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

                {/* Upload Buttons – nur wenn Typ gewählt */}
                {selectedTyp && (
                  <div>
                    <div style={{ fontSize: 11, color: "#888", marginBottom: 8 }}>2. Fotos auswählen (Kamera oder Galerie, mehrere möglich):</div>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>

                      {/* Kamera */}
                      <label style={{ ...C.btnP, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, opacity: fotoUpload ? 0.6 : 1 }}>
                        📸 Kamera
                        <input type="file" accept="image/*" capture="environment" multiple style={{ display: "none" }}
                          onChange={e => e.target.files && fotosHochladen(e.target.files, selectedTyp)} />
                      </label>

                      {/* Galerie */}
                      <label style={{ ...C.btnS, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, opacity: fotoUpload ? 0.6 : 1 }}>
                        🖼 Aus Galerie
                        <input type="file" accept="image/*" multiple style={{ display: "none" }}
                          onChange={e => e.target.files && fotosHochladen(e.target.files, selectedTyp)} />
                      </label>
                    </div>
                    {fotoUpload && <div style={{ fontSize: 12, color: ACCENT, marginTop: 8 }}>⏳ Fotos werden hochgeladen...</div>}
                  </div>
                )}
              </div>

              {/* Foto Galerie */}
              {fotos.length === 0 ? (
                <div style={{ ...C.card, textAlign: "center", padding: 32, color: "#bbb" }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>📷</div>
                  <div>Noch keine Fotos für heute</div>
                  <div style={{ fontSize: 11, marginTop: 4 }}>Wähle eine Kategorie oben und lade Fotos hoch</div>
                </div>
              ) : (
                <>
                  {/* Fotos nach Typ gruppiert */}
                  {FOTO_TYPEN.filter(typ => fotos.some(f => f.typ === typ)).map(typ => (
                    <div key={typ} style={{ marginBottom: 20 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "#888", marginBottom: 8, textTransform: "uppercase" as any }}>
                        {typ} ({fotos.filter(f => f.typ === typ).length})
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr 1fr 1fr", gap: 10 }}>
                        {fotos.filter(f => f.typ === typ).map(f => (
                          <div key={f.id} style={{ borderRadius: 10, overflow: "hidden", border: "1px solid #eee", position: "relative", background: "#f8f8f8" }}>
                            <div
                              onClick={() => setLightbox(f)}
                              style={{ cursor: "pointer", width: "100%", height: 130, overflow: "hidden" }}>
                              <img
                                src={f.url}
                                alt={f.typ}
                                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", pointerEvents: "none" }}
                                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                              />
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
                  ))}
                </>
              )}
            </div>
          )}

          {/* ── ÜBERSICHT ────────────────────────────────────────────────── */}
          {activeTab === "uebersicht" && <UebersichtTab bsId={selectedBS} />}
        </>
      )}

      {/* Material Modal */}
      {showMatForm && editMat && (
        <MaterialFormular material={editMat} isMobile={isMobile} onSave={saveMaterial} onClose={() => { setShowMatForm(false); setEditMat(null); }} />
      )}

      {/* Lightbox */}
      {lightbox && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.92)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", zIndex: 99999, cursor: "zoom-out" }}
          onClick={() => setLightbox(null)}>
          {/* Schließen Button oben rechts */}
          <button
            onClick={e => { e.stopPropagation(); setLightbox(null); }}
            style={{ position: "fixed", top: 16, right: 16, background: "rgba(255,255,255,0.15)", border: "none", borderRadius: "50%", width: 44, height: 44, cursor: "pointer", color: "#fff", fontSize: 22, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100000 }}>
            ✕
          </button>
          {/* Bild */}
          <img
            src={lightbox.url}
            alt={lightbox.typ}
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: "95vw", maxHeight: "85vh", objectFit: "contain", borderRadius: 8, boxShadow: "0 4px 32px rgba(0,0,0,0.5)", cursor: "default" }}
            onError={(e) => { (e.target as HTMLImageElement).src = ""; }}
          />
          {/* Info unten */}
          <div style={{ marginTop: 14, textAlign: "center", color: "rgba(255,255,255,0.6)", fontSize: 12 }}>
            <span style={{ background: "rgba(255,255,255,0.1)", padding: "3px 10px", borderRadius: 8, marginRight: 8 }}>{lightbox.typ}</span>
            {lightbox.erstellt_von && <span>{lightbox.erstellt_von}</span>}
            <span style={{ display: "block", marginTop: 6, fontSize: 11, color: "rgba(255,255,255,0.3)" }}>Tippen zum Schließen</span>
          </div>
        </div>
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
          <div>
            <label style={C.lbl}>Arbeitsbeginn</label>
            <input type="time" style={C.inp} value={eintrag.arbeitsbeginn || ""} onChange={e => setEintrag((x: any) => ({ ...x, arbeitsbeginn: e.target.value }))} />
          </div>
          <div>
            <label style={C.lbl}>Arbeitsende</label>
            <input type="time" style={C.inp} value={eintrag.arbeitsende || ""} onChange={e => setEintrag((x: any) => ({ ...x, arbeitsende: e.target.value }))} />
          </div>
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
            <label style={{ ...C.btnS, cursor: "pointer", fontSize: 12 }}>
              📷 Foto
              <input type="file" accept="image/*" style={{ display: "none" }} onChange={lsFotoHochladen} />
            </label>
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

// ── Material Karte mit Fotos ───────────────────────────────────────────────────
function MaterialKarte({ m, fotos, isMobile, onEdit, onDelete, onFotoUpload, onFotoDelete, onLightbox, uploading }: any) {
  const [showFotos, setShowFotos] = useState(false);

  // Fotos die zu diesem Material gehören (Typ "Material" oder "Lieferschein")
  const matFotos = fotos.filter((f: any) => f.typ === "Material" || f.typ === "Lieferschein" || f.typ === "Einbauort");

  return (
    <div style={{ ...C.card, marginBottom: 10, padding: "14px 16px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#222" }}>{m.materialart}</div>
          <div style={{ fontSize: 12, color: ACCENT, marginTop: 2 }}>{m.menge} {m.einheit}</div>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 8, background: m.status === "verbaut" ? "#e8f5f3" : m.status === "gelagert" ? "#fff3e0" : "#f0f4f3", color: m.status === "verbaut" ? ACCENT : m.status === "gelagert" ? "#BA7517" : "#888", fontWeight: 600 }}>
            {m.status}
          </span>
          <button onClick={onEdit} style={{ padding: "3px 8px", borderRadius: 6, border: "1px solid #eee", background: "#fff", cursor: "pointer", fontSize: 11, color: "#555" }}>✎</button>
          <button onClick={onDelete} style={{ padding: "3px 8px", borderRadius: 6, border: "none", background: "#E24B4A18", cursor: "pointer", fontSize: 11, color: "#E24B4A" }}>✕</button>
        </div>
      </div>

      {/* Details */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr 1fr 1fr", gap: 8, fontSize: 11, color: "#666", marginBottom: 8 }}>
        {m.einbauort       && <div><span style={{ color: "#aaa" }}>Einbauort: </span>{m.einbauort}</div>}
        {m.lv_position     && <div><span style={{ color: "#aaa" }}>LV-Pos: </span>{m.lv_position}</div>}
        {m.lieferant       && <div><span style={{ color: "#aaa" }}>Lieferant: </span>{m.lieferant}</div>}
        {m.lieferschein_nr && <div><span style={{ color: "#aaa" }}>LS-Nr: </span>{m.lieferschein_nr}</div>}
      </div>

      {m.besonderheiten && (
        <div style={{ marginBottom: 8, padding: "6px 10px", background: "#fff8e1", borderRadius: 8, fontSize: 11, color: "#BA7517" }}>
          ⚠ {m.besonderheiten}
        </div>
      )}

      {/* Lieferschein Foto (aus Material-Formular) */}
      {m.lieferschein_foto && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 10, color: "#aaa", marginBottom: 4 }}>Lieferschein:</div>
          <img src={m.lieferschein_foto} alt="Lieferschein"
            style={{ height: 70, borderRadius: 6, border: "1px solid #eee", cursor: "pointer" }}
            onClick={() => onLightbox({ url: m.lieferschein_foto, typ: "Lieferschein", erstellt_von: m.erstellt_von })} />
        </div>
      )}

      {/* Fotos Toggle */}
      <div style={{ borderTop: "1px solid #f5f5f5", paddingTop: 10, marginTop: 4 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <button onClick={() => setShowFotos(s => !s)}
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: ACCENT, fontWeight: 500, display: "flex", alignItems: "center", gap: 4, padding: 0 }}>
            📷 Fotos ({matFotos.length}) {showFotos ? "▲" : "▼"}
          </button>

          {/* Foto Upload direkt beim Material */}
          <div style={{ display: "flex", gap: 6 }}>
            <label style={{ padding: "4px 10px", borderRadius: 8, border: "1.5px solid " + ACCENT, background: "#e8f5f3", color: ACCENT, cursor: "pointer", fontSize: 11, fontWeight: 600, opacity: uploading ? 0.6 : 1 }}>
              📸 Kamera
              <input type="file" accept="image/*" capture="environment" multiple style={{ display: "none" }}
                onChange={e => e.target.files && onFotoUpload(e.target.files, "Material")} />
            </label>
            <label style={{ padding: "4px 10px", borderRadius: 8, border: "1.5px solid #eee", background: "#fff", color: "#555", cursor: "pointer", fontSize: 11, opacity: uploading ? 0.6 : 1 }}>
              🖼 Galerie
              <input type="file" accept="image/*" multiple style={{ display: "none" }}
                onChange={e => e.target.files && onFotoUpload(e.target.files, "Material")} />
            </label>
          </div>
        </div>

        {/* Foto Galerie */}
        {showFotos && (
          <div style={{ marginTop: 10 }}>
            {matFotos.length === 0 ? (
              <div style={{ fontSize: 11, color: "#bbb", textAlign: "center", padding: "12px 0" }}>
                Noch keine Fotos – lade direkt hier hoch
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr 1fr" : "1fr 1fr 1fr 1fr 1fr", gap: 6 }}>
                {matFotos.map((f: any) => (
                  <div key={f.id} style={{ position: "relative", borderRadius: 8, overflow: "hidden", border: "1px solid #eee" }}>
                    <img src={f.url} alt={f.typ}
                      style={{ width: "100%", height: 80, objectFit: "cover", display: "block", cursor: "pointer" }}
                      onClick={() => onLightbox(f)}
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                    <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "rgba(0,0,0,0.5)", padding: "2px 4px" }}>
                      <div style={{ fontSize: 9, color: "#fff" }}>{f.typ}</div>
                    </div>
                    <button onClick={() => onFotoDelete(f.id)}
                      style={{ position: "absolute", top: 3, right: 3, background: "rgba(0,0,0,0.55)", border: "none", borderRadius: "50%", width: 18, height: 18, cursor: "pointer", color: "#fff", fontSize: 9, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      ✕
                    </button>
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
