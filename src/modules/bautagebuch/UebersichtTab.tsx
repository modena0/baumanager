import { useState, useEffect } from "react";
import { C, ACCENT } from "../../lib/constants";
import { supabase } from "../../lib/supabase";

export function UebersichtTab({ bsId, bsName, datum }: any) {
  const [eintraege,   setEintraege]   = useState<any[]>([]);
  const [materialien, setMaterialien] = useState<any[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [filterVon,   setFilterVon]   = useState("");
  const [filterBis,   setFilterBis]   = useState("");
  const [editId,      setEditId]      = useState<number | null>(null);
  const [editData,    setEditData]    = useState<any>({});
  const [saving,      setSaving]      = useState(false);

  useEffect(() => {
    laden();
  }, [bsId]);

  async function laden() {
    const { data: e } = await supabase.from("bautagebuch_eintraege").select("*").eq("baustelle_id", bsId).order("datum", { ascending: false });
    const { data: m } = await supabase.from("bautagebuch_material").select("*").eq("baustelle_id", bsId).order("datum", { ascending: false });
    setEintraege(e || []);
    setMaterialien(m || []);
    setLoading(false);
  }

  function startEdit(e: any) {
    setEditId(e.id);
    setEditData({ ...e });
  }

  function cancelEdit() {
    setEditId(null);
    setEditData({});
  }

  async function saveEdit() {
    if (!editId) return;
    setSaving(true);
    await supabase.from("bautagebuch_eintraege").update({
      notizen:       editData.notizen,
      besonderheiten: editData.besonderheiten,
      arbeitsbeginn: editData.arbeitsbeginn,
      arbeitsende:   editData.arbeitsende,
      wetter:        editData.wetter,
      temperatur:    editData.temperatur,
      wind:          editData.wind,
      niederschlag:  editData.niederschlag,
    }).eq("id", editId);
    setEintraege(prev => prev.map(e => e.id === editId ? { ...e, ...editData } : e));
    setEditId(null);
    setEditData({});
    setSaving(false);
  }

  const gefiltertE = eintraege.filter(e => (!filterVon || e.datum >= filterVon) && (!filterBis || e.datum <= filterBis));
  const gefiltertM = materialien.filter(m => (!filterVon || m.datum >= filterVon) && (!filterBis || m.datum <= filterBis));

  // Nur ein Eintrag pro Tag (neuester gewinnt)
  const eintraegePróTag: Record<string, any> = {};
  for (const e of gefiltertE) {
    if (!eintraegePróTag[e.datum]) eintraegePróTag[e.datum] = e;
  }
  const eintraegeUniq = Object.values(eintraegePróTag).sort((a, b) => b.datum.localeCompare(a.datum));

  async function exportCSV() {
    const { data: alleN } = await supabase.from("chat_nachrichten").select("*").eq("baustelle_id", bsId).order("created_at");
    const rows = [
      [`Bautagebuch – ${bsName}`], [`Export: ${new Date().toLocaleDateString("de-DE")}`], [],
      ["=== TAGESEINTRÄGE ==="],
      ["Datum", "Wetter", "Temp", "Wind", "Niederschlag", "Beginn", "Ende", "Notizen", "Besonderheiten", "Erstellt von"],
      ...eintraegeUniq.map(e => [e.datum, e.wetter, e.temperatur, e.wind, e.niederschlag, e.arbeitsbeginn, e.arbeitsende, e.notizen, e.besonderheiten, e.erstellt_von]),
      [], ["=== MATERIAL ==="],
      ["Datum", "Materialart", "Menge", "Einheit", "Einbauort", "LV-Pos", "Lieferant", "LS-Nr", "Status", "Besonderheiten"],
      ...materialien.map(m => [m.datum, m.materialart, m.menge, m.einheit, m.einbauort, m.lv_position, m.lieferant, m.lieferschein_nr, m.status, m.besonderheiten]),
      [], ["=== SASCHA CHAT ==="],
      ["Datum", "Zeit", "Absender", "Rolle", "Nachricht", "Übertragen"],
      ...(alleN || []).map(n => [n.datum, n.created_at ? new Date(n.created_at).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }) : "", n.absender, n.absender_rolle, n.typ === "foto" ? "[Foto]" : n.text, n.ki_verarbeitet ? "Ja" : "Nein"]),
    ];
    const csv = "\uFEFF" + rows.map(r => r.map(c => `"${(c || "").toString().replace(/"/g, '""')}"`).join(";")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    a.download = `Bautagebuch_${bsName}_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  }

  const fmtDatum = (d: string) => {
    const dt = new Date(d + "T12:00:00");
    return dt.toLocaleDateString("de-DE", { weekday: "long", day: "2-digit", month: "2-digit", year: "2-digit" });
  };

  if (loading) return <div style={{ textAlign: "center", color: "#bbb", padding: 32 }}>Lädt...</div>;

  return (
    <div>
      {/* Filter + Export */}
      <div style={{ ...C.card, padding: "12px 14px", marginBottom: 14 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div><label style={C.lbl}>Von</label><input type="date" style={{ ...C.inp, marginBottom: 0, width: "auto" }} value={filterVon} onChange={e => setFilterVon(e.target.value)} /></div>
          <div><label style={C.lbl}>Bis</label><input type="date" style={{ ...C.inp, marginBottom: 0, width: "auto" }} value={filterBis} onChange={e => setFilterBis(e.target.value)} /></div>
          <button onClick={() => { setFilterVon(""); setFilterBis(""); }} style={{ ...C.btnS, fontSize: 12 }}>Reset</button>
          <button onClick={exportCSV} style={{ ...C.btnS, fontSize: 12, marginLeft: "auto" }}>📊 CSV Export</button>
        </div>
      </div>

      {/* Statistiken */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 14 }}>
        {[["Einträge", eintraegeUniq.length, "📝"], ["Materialien", gefiltertM.length, "📦"], ["Besonderheiten", eintraegeUniq.filter(e => e.besonderheiten).length, "⚠"]].map(([label, val, icon]) => (
          <div key={label as string} style={{ ...C.card, textAlign: "center", padding: "12px 8px" }}>
            <div style={{ fontSize: 20 }}>{icon}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: ACCENT }}>{val}</div>
            <div style={{ fontSize: 11, color: "#aaa" }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Tageseinträge */}
      <div style={{ ...C.card, padding: "14px 16px" }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#222", marginBottom: 12 }}>Tageseinträge</div>
        {eintraegeUniq.length === 0 && <div style={{ fontSize: 12, color: "#bbb", textAlign: "center", padding: 16 }}>Keine Einträge</div>}
        {eintraegeUniq.map(e => (
          <div key={e.id} style={{ borderBottom: "1px solid #f5f5f5", marginBottom: 4 }}>

            {/* Tag-Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0" }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#222" }}>
                {fmtDatum(e.datum)}
              </span>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {e.besonderheiten && <span style={{ fontSize: 10, color: "#BA7517" }}>⚠</span>}
                {editId === e.id ? (
                  <>
                    <button onClick={saveEdit} disabled={saving}
                      style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, border: "none", background: ACCENT, color: "#fff", cursor: "pointer", opacity: saving ? 0.6 : 1 }}>
                      {saving ? "..." : "✓ Speichern"}
                    </button>
                    <button onClick={cancelEdit}
                      style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, border: "1.5px solid #eee", background: "#fff", cursor: "pointer", color: "#555" }}>
                      Abbrechen
                    </button>
                  </>
                ) : (
                  <button onClick={() => startEdit(e)}
                    style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, border: "1.5px solid #eee", background: "#fff", cursor: "pointer", color: "#555" }}>
                    ✏ Bearbeiten
                  </button>
                )}
              </div>
            </div>

            {/* Ansicht oder Bearbeitung */}
            {editId === e.id ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingBottom: 14 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div>
                    <label style={C.lbl}>Arbeitsbeginn</label>
                    <input type="time" style={C.inp} value={editData.arbeitsbeginn || ""}
                      onChange={e => setEditData((x: any) => ({ ...x, arbeitsbeginn: e.target.value }))} />
                  </div>
                  <div>
                    <label style={C.lbl}>Arbeitsende</label>
                    <input type="time" style={C.inp} value={editData.arbeitsende || ""}
                      onChange={e => setEditData((x: any) => ({ ...x, arbeitsende: e.target.value }))} />
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div>
                    <label style={C.lbl}>Wetter</label>
                    <input style={C.inp} value={editData.wetter || ""} placeholder="z.B. Sonnig"
                      onChange={e => setEditData((x: any) => ({ ...x, wetter: e.target.value }))} />
                  </div>
                  <div>
                    <label style={C.lbl}>Temperatur</label>
                    <input style={C.inp} value={editData.temperatur || ""} placeholder="z.B. 18°C"
                      onChange={e => setEditData((x: any) => ({ ...x, temperatur: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <label style={C.lbl}>Notizen</label>
                  <textarea rows={4} style={{ ...C.inp, resize: "vertical" as any, fontFamily: "system-ui" }}
                    value={editData.notizen || ""} placeholder="Was wurde heute gemacht..."
                    onChange={e => setEditData((x: any) => ({ ...x, notizen: e.target.value }))} />
                </div>
                <div>
                  <label style={C.lbl}>Besonderheiten / Abweichungen</label>
                  <textarea rows={2} style={{ ...C.inp, resize: "vertical" as any, fontFamily: "system-ui", borderColor: editData.besonderheiten ? "#BA7517" : "#e8eaed" }}
                    value={editData.besonderheiten || ""} placeholder="z.B. Mehrverbrauch, Schäden..."
                    onChange={e => setEditData((x: any) => ({ ...x, besonderheiten: e.target.value }))} />
                </div>
              </div>
            ) : (
              <div style={{ paddingBottom: 10 }}>
                <div style={{ display: "flex", gap: 10, fontSize: 11, color: "#888", flexWrap: "wrap", marginBottom: 4 }}>
                  {e.wetter && <span>🌤 {e.wetter} {e.temperatur}</span>}
                  {e.arbeitsbeginn && <span>⏰ {e.arbeitsbeginn}{e.arbeitsende ? `–${e.arbeitsende}` : ""}</span>}
                </div>
                {e.notizen && (
                  <div style={{ fontSize: 12, color: "#555", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
                    {e.notizen}
                  </div>
                )}
                {e.besonderheiten && (
                  <div style={{ marginTop: 6, fontSize: 11, color: "#BA7517", background: "#fff8ee", padding: "6px 10px", borderRadius: 6 }}>
                    ⚠ {e.besonderheiten}
                  </div>
                )}
                {!e.notizen && !e.besonderheiten && (
                  <div style={{ fontSize: 11, color: "#ccc" }}>Keine Notizen</div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
