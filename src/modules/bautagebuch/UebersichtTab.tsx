import { useState, useEffect } from "react";
import { C, ACCENT } from "../../lib/constants";
import { supabase } from "../../lib/supabase";

export function UebersichtTab({ bsId, bsName, datum }: any) {
  const [eintraege,   setEintraege]   = useState<any[]>([]);
  const [materialien, setMaterialien] = useState<any[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [filterVon,   setFilterVon]   = useState("");
  const [filterBis,   setFilterBis]   = useState("");

  useEffect(() => {
    async function laden() {
      const { data: e } = await supabase.from("bautagebuch_eintraege").select("*").eq("baustelle_id", bsId).order("datum", { ascending: false });
      const { data: m } = await supabase.from("bautagebuch_material").select("*").eq("baustelle_id", bsId).order("datum", { ascending: false });
      setEintraege(e || []);
      setMaterialien(m || []);
      setLoading(false);
    }
    laden();
  }, [bsId]);

  const gefiltertE = eintraege.filter(e => (!filterVon || e.datum >= filterVon) && (!filterBis || e.datum <= filterBis));
  const gefiltertM = materialien.filter(m => (!filterVon || m.datum >= filterVon) && (!filterBis || m.datum <= filterBis));

  async function exportCSV() {
    const { data: alleN } = await supabase.from("chat_nachrichten").select("*").eq("baustelle_id", bsId).order("created_at");
    const rows = [
      [`Bautagebuch – ${bsName}`], [`Export: ${new Date().toLocaleDateString("de-DE")}`], [],
      ["=== TAGESEINTRÄGE ==="],
      ["Datum", "Wetter", "Temp", "Wind", "Niederschlag", "Beginn", "Ende", "Notizen", "Besonderheiten", "Erstellt von"],
      ...eintraege.map(e => [e.datum, e.wetter, e.temperatur, e.wind, e.niederschlag, e.arbeitsbeginn, e.arbeitsende, e.notizen, e.besonderheiten, e.erstellt_von]),
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
        {[["Einträge", gefiltertE.length, "📝"], ["Materialien", gefiltertM.length, "📦"], ["Besonderheiten", gefiltertE.filter(e => e.besonderheiten).length, "⚠"]].map(([label, val, icon]) => (
          <div key={label as string} style={{ ...C.card, textAlign: "center", padding: "12px 8px" }}>
            <div style={{ fontSize: 20 }}>{icon}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: ACCENT }}>{val}</div>
            <div style={{ fontSize: 11, color: "#aaa" }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Einträge */}
      <div style={{ ...C.card, padding: "14px 16px" }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#222", marginBottom: 12 }}>Tageseinträge</div>
        {gefiltertE.length === 0 && <div style={{ fontSize: 12, color: "#bbb", textAlign: "center", padding: 16 }}>Keine Einträge</div>}
        {gefiltertE.map(e => (
          <div key={e.id} style={{ padding: "10px 0", borderBottom: "1px solid #f5f5f5" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#222" }}>
                {new Date(e.datum).toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", year: "2-digit" })}
              </span>
              <span style={{ fontSize: 11, color: "#aaa" }}>{e.erstellt_von}</span>
            </div>
            <div style={{ display: "flex", gap: 10, fontSize: 11, color: "#888", flexWrap: "wrap" }}>
              {e.wetter && <span>🌤 {e.wetter} {e.temperatur}</span>}
              {e.arbeitsbeginn && <span>⏰ {e.arbeitsbeginn}–{e.arbeitsende}</span>}
              {e.notizen && <span style={{ color: "#555" }}>{e.notizen.slice(0, 80)}{e.notizen.length > 80 ? "..." : ""}</span>}
            </div>
            {e.besonderheiten && <div style={{ marginTop: 4, fontSize: 11, color: "#BA7517" }}>⚠ {e.besonderheiten}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
