import { useState, useEffect } from "react";
import { C, ACCENT } from "../lib/constants";
import { supabase } from "../lib/supabase";
import { ChatTab }      from "./bautagebuch/ChatTab";
import { TageslogTab }  from "./bautagebuch/TageslogTab";
import { MaterialTab }  from "./bautagebuch/MaterialTab";
import { FotosTab }     from "./bautagebuch/FotosTab";
import { UebersichtTab } from "./bautagebuch/UebersichtTab";

export function BautagebuchTab({ data, currentUser, rolle }: any) {
  const [selectedBS,  setSelectedBS]  = useState<number | null>(null);
  const [datum,       setDatum]       = useState(new Date().toISOString().split("T")[0]);
  const [activeTab,   setActiveTab]   = useState<"chat" | "tageslog" | "material" | "fotos" | "uebersicht">("chat");
  const [eintrag,     setEintrag]     = useState<any>(null);
  const [materialien, setMaterialien] = useState<any[]>([]);
  const [fotos,       setFotos]       = useState<any[]>([]);
  const [loading,     setLoading]     = useState(false);
  const isMobile = window.innerWidth < 768;

  const meineBS = rolle === "baustellen_leitung"
    ? data.baustellen.filter((b: any) => b.mitarbeiter?.includes(currentUser?.id))
    : data.baustellen.filter((b: any) => b.status !== "abgeschlossen");

  useEffect(() => {
    if (selectedBS) ladenAlles();
  }, [selectedBS, datum]);

  async function ladenAlles() {
    setLoading(true);

    // Tageseintrag
    const { data: e } = await supabase.from("bautagebuch_eintraege")
      .select("*").eq("baustelle_id", selectedBS!).eq("datum", datum).maybeSingle();
    if (e) {
      setEintrag({ ...e, mitarbeiter_anwesend: Array.isArray(e.mitarbeiter_anwesend) ? e.mitarbeiter_anwesend.map(Number) : [], geraete: e.geraete || [] });
    } else {
      setEintrag({ baustelle_id: selectedBS, datum, mitarbeiter_anwesend: [], geraete: [] });
    }

    // Material
    const { data: m } = await supabase.from("bautagebuch_material")
      .select("*").eq("baustelle_id", selectedBS!).eq("datum", datum).order("id");
    setMaterialien(m || []);

    // Fotos
    const { data: f } = await supabase.from("bautagebuch_fotos")
      .select("*").eq("baustelle_id", selectedBS!).eq("datum", datum).order("id");
    setFotos(f || []);

    setLoading(false);
  }

  async function exportPDF() {
    if (!selectedBS || !eintrag) return;
    const bs = data.baustellen.find((b: any) => b.id === selectedBS);

    // jsPDF laden
    if (!(window as any).jspdf) {
      await new Promise(r => {
        const s = document.createElement("script");
        s.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
        s.onload = r;
        document.head.appendChild(s);
      });
    }
    const { jsPDF } = (window as any).jspdf;
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

    const hl = (x1: number, x2: number, y: number, lw = 0.3) => { doc.setLineWidth(lw); doc.setDrawColor(0); doc.line(x1, y, x2, y); };
    const vl = (x: number, y1: number, y2: number, lw = 0.3) => { doc.setLineWidth(lw); doc.setDrawColor(0); doc.line(x, y1, x, y2); };
    const fr = (x: number, y: number, w: number, h: number, r: number, g: number, b: number) => { doc.setFillColor(r, g, b); doc.setDrawColor(0); doc.setLineWidth(0.3); doc.rect(x, y, w, h, "FD"); doc.setFillColor(0, 0, 0); };
    const t = (x: number, y: number, s: string, sz = 7.5, bold = false) => { doc.setFont("helvetica", bold ? "bold" : "normal"); doc.setFontSize(sz); doc.setTextColor(0); doc.text(s, x, y); };
    const tr = (x: number, y: number, s: string) => { doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.text(s, x, y, { align: "right" }); };

    // Rahmen
    hl(15.7, 204.4, 6.4, 0.5); vl(15.7, 6.4, 54.1, 0.5); vl(204.4, 6.4, 54.1, 0.5);
    hl(15.7, 204.4, 54.1, 0.8); vl(15.7, 54.1, 290.2, 0.5); vl(204.4, 54.1, 290.2, 0.5); hl(15.7, 204.4, 290.2, 0.5);

    // Logo
    doc.setFillColor(22, 96, 168); doc.rect(150, 6.4, 54, 22, "F");
    doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(20); doc.text("DVT", 152, 19);
    doc.setFontSize(13); doc.text(">>", 167, 20); doc.setTextColor(0, 0, 0);
    t(148, 30.5, "Dresdner Verkehrstechnik GmbH", 9, true);
    ["Zur Wetterwarte 27", "01109 Dresden", "0351/21 527 200", "0351/21 527 220"].forEach((z, i) => t(164.5, 34.8 + i * 3.9, z, 7.5));
    t(16.8, 44, "Bautagebuch", 20, true);

    // Header
    hl(15.7, 204.4, 59.7); vl(130, 54.1, 59.7); vl(148, 54.1, 59.7); vl(165, 54.1, 59.7);
    t(134.5, 58.5, "Nr.", 7.5, true); t(148.5, 58.5, "1", 7.5, true); t(166.1, 58.5, "Datum:", 7.5, true);
    tr(202, 58.5, datum.split("-").reverse().join("."));

    hl(15.7, 204.4, 65.1); vl(130, 59.7, 65.1); vl(148, 59.7, 65.1);
    t(16.5, 63.5, "Baustelle:", 7.5, true); t(42.7, 63.5, bs?.name || "");
    t(123.9, 63.5, "Wetter:", 7.5, true); t(148.5, 63.5, eintrag.wetter || "");

    hl(15.7, 204.4, 70.5); vl(130, 65.1, 70.5); vl(148, 65.1, 70.5); vl(166, 65.1, 70.5); vl(178, 65.1, 70.5); vl(190, 65.1, 70.5);
    t(16.5, 69, "Arbeitszeit:", 7.5, true);
    if (eintrag.arbeitsbeginn) t(40, 69, eintrag.arbeitsbeginn);
    t(67.9, 68.8, "bis");
    if (eintrag.arbeitsende) t(73, 69, eintrag.arbeitsende);
    t(123.9, 69, "Temperatur min.", 7.5, true);
    if (eintrag.temperatur) t(152.5, 69, eintrag.temperatur.replace("°C", "").trim());
    t(157.3, 68.8, "°C"); t(170.9, 68.8, "max.", 7.5, true); t(186, 68.8, "°C");
    hl(15.7, 204.4, 74.3);

    // Personal + Geräte Header
    const C2 = [15.7, 22.9, 61.1, 78.5, 149.5, 163.8, 185.3, 204.4];
    fr(15.7, 74.3, 188.7, 5.4, 216, 216, 216);
    C2.slice(1, 7).forEach(x => vl(x, 74.3, 84.3));
    t(16.5, 78.3, "Personaleinsatz", 7.5, true); t(67.3, 78.3, "Std.", 7.5, true);
    t(79.3, 78.3, "Geräte-/LKW-Einsatz", 7.5, true); t(139, 78.3, "Art des", 7.5, true);
    t(154.1, 78.3, "Std.", 7.5, true); t(174.4, 78.3, "Bemerkungen", 7.5, true);
    hl(15.7, 204.4, 84.3); fr(15.7, 79.7, 188.7, 4.6, 216, 216, 216);
    C2.slice(1, 7).forEach(x => vl(x, 79.7, 84.3));
    t(16.5, 83.2, "Anzahl"); t(79.3, 83.2, "Gerätes");

    // Personal Zeilen
    const personal = [
      { rolle: "Polier", anzahl: "", stunden: "" },
      { rolle: "Vorarbeiter", anzahl: "", stunden: "" },
      { rolle: "Facharbeiter", anzahl: "", stunden: "" },
      { rolle: "Maschinisten", anzahl: "", stunden: "" },
      { rolle: "Helfer", anzahl: "", stunden: "" },
      { rolle: "SUB", anzahl: "", stunden: "" },
      { rolle: "", anzahl: "", stunden: "" },
    ];
    const y_rows = [84.3, 89.7, 95.1, 100.5, 105.9, 111.3, 116.8];
    y_rows.forEach((y_top, i) => {
      hl(15.7, 204.4, y_top + 5.4);
      C2.slice(1, 7).forEach(x => vl(x, y_top, y_top + 5.4));
      const p = personal[i];
      if (p?.rolle) { doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.text(p.rolle, (22.9 + 61.1) / 2, y_top + 3.8, { align: "center" }); }
    });

    // Ausgeführte Arbeiten
    const y_arb = 122.2;
    fr(15.7, y_arb, 188.7, 5.6, 216, 216, 216);
    vl(42, y_arb, y_arb + 5.6); vl(185.3, y_arb, y_arb + 5.6); hl(15.7, 204.4, y_arb + 5.6);
    t(16.5, y_arb + 4, "Ausgeführte Arbeiten:", 7.5, true); t(193, y_arb + 4.5, "AK", 7.5, true);

    const arbeitenLines = (eintrag.notizen || "").split("\n").filter((l: string) => l.trim());
    const y_arb_rows = [127.8, 133.6, 139.2, 144.8, 150.5, 156.1, 161.7, 167.3, 173.0, 178.6];
    for (let i = 0; i < Math.max(arbeitenLines.length, 8); i++) {
      const y_top = i < y_arb_rows.length ? y_arb_rows[i] : y_arb_rows[y_arb_rows.length - 1] + (i - y_arb_rows.length + 1) * 5.6;
      hl(15.7, 204.4, y_top + 5.6); vl(42, y_top, y_top + 5.6); vl(185.3, y_top, y_top + 5.6);
      if (i < arbeitenLines.length) t(42.7, y_top + 4, arbeitenLines[i]);
    }

    // Behinderungen
    const y_beh = 189.9;
    fr(15.7, y_beh, 188.7, 5.6, 216, 216, 216); hl(15.7, 204.4, y_beh + 5.6);
    t(16.5, y_beh + 4, "Behinderungen/Erschwernisse", 7.5, true);
    [195.5, 201.3].forEach(y_top => { hl(15.7, 204.4, y_top + 5.6); vl(42, y_top, y_top + 5.6); vl(185.3, y_top, y_top + 5.6); });

    // Leistungsänderungen
    const y_lei = 212.5;
    fr(15.7, y_lei, 188.7, 5.6, 216, 216, 216); hl(15.7, 204.4, y_lei + 5.6);
    t(16.5, y_lei + 4, "Leistungsänderungen", 7.5, true);
    [218.1, 223.9, 229.5].forEach(y_top => { hl(15.7, 204.4, y_top + 5.6); vl(42, y_top, y_top + 5.6); vl(185.3, y_top, y_top + 5.6); });

    // Besonderheiten
    const y_bv = 240.8;
    fr(15.7, y_bv, 188.7, 8.4, 216, 216, 216); hl(15.7, 204.4, y_bv + 8.4);
    t(16.5, y_bv + 4.2, "Besondere Vorkommnisse/Sonstiges", 7.5, true);
    doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.text("(Begehungen/Abnahmen/…)", 16.4, y_bv + 8);
    const besLines = (eintrag.besonderheiten || "").split("\n").filter((l: string) => l.trim());
    [249.2, 255.6].forEach((y_top, i) => { hl(15.7, 204.4, y_top + 5.6); if (i < besLines.length) t(16.5, y_top + 4, besLines[i]); });

    // Unterschriften
    hl(15.7, 100, 266.9, 0.5); hl(120, 204.4, 266.9, 0.5);
    t(16.5, 270, "Ort, Datum"); t(42.7, 270, "Dresden,"); t(63.2, 270, datum.split("-").reverse().join("."));
    t(157.3, 270, "Ort, Datum");
    t(16.5, 276.5, "Auftragnehmer:", 7.5, true); t(157.3, 276.5, "Auftraggeber:", 7.5, true);
    t(133.2, 287, "erhalten:", 7.5, true);

    doc.save(`Bautagebuch_${bs?.name}_${datum}.pdf`);
  }

  // ── Baustellen-Auswahl ─────────────────────────────────────────────────────
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
          <button onClick={exportPDF} style={{ ...C.btnP, fontSize: 12 }}>📄 PDF</button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 12, background: "#f0f4f3", borderRadius: 12, padding: 4, overflowX: "auto", flexShrink: 0 }}>
        {[
          { key: "chat",       label: "💬 Sascha" },
          { key: "tageslog",   label: "📝 Tageslog" },
          { key: "material",   label: `📦 Material (${materialien.length})` },
          { key: "fotos",      label: `📷 Fotos (${fotos.length})` },
          { key: "uebersicht", label: "📊 Übersicht" },
        ].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key as any)}
            style={{ flex: "0 0 auto", padding: "8px 14px", borderRadius: 8, border: "none", background: activeTab === tab.key ? "#fff" : "transparent", cursor: "pointer", fontSize: 12, fontWeight: activeTab === tab.key ? 600 : 400, color: activeTab === tab.key ? ACCENT : "#888", boxShadow: activeTab === tab.key ? "0 1px 4px rgba(0,0,0,0.08)" : "none" }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minHeight: 0, overflow: activeTab === "chat" ? "hidden" : "auto" }}>
        {loading && activeTab !== "chat" ? (
          <div style={{ textAlign: "center", color: "#bbb", padding: 32 }}>Lädt...</div>
        ) : (
          <>
            {activeTab === "chat" && (
              <ChatTab bsId={selectedBS} bsName={bs?.name || ""} datum={datum} currentUser={currentUser} rolle={rolle} />
            )}
            {activeTab === "tageslog" && (
              <TageslogTab eintrag={eintrag} setEintrag={setEintrag} data={data} currentUser={currentUser} isMobile={isMobile} />
            )}
            {activeTab === "material" && (
              <MaterialTab bsId={selectedBS} datum={datum} eintragId={eintrag?.id} materialien={materialien} setMaterialien={setMaterialien} currentUser={currentUser} isMobile={isMobile} />
            )}
            {activeTab === "fotos" && (
              <FotosTab bsId={selectedBS} datum={datum} eintragId={eintrag?.id} fotos={fotos} setFotos={setFotos} currentUser={currentUser} isMobile={isMobile} />
            )}
            {activeTab === "uebersicht" && (
              <UebersichtTab bsId={selectedBS} bsName={bs?.name || ""} datum={datum} />
            )}
          </>
        )}
      </div>
    </div>
  );
}
