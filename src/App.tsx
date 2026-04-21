import { useState, useEffect } from "react";
import type { ComponentType } from "react";
import { NAV, INIT, C, ACCENT } from "./lib/constants";
import { autoKat } from "./lib/utils";
import { supabase } from "./lib/supabase";
import { EditModal }       from "./components/EditModal";
import { PinModal }        from "./components/PinModal";
import { Dashboard }       from "./modules/Dashboard";
import { MitarbeiterTab }  from "./modules/MitarbeiterTab";
import { BaustellenTab }   from "./modules/BaustellenTab";
import { KalenderTab }     from "./modules/KalenderTab";
import { ZuordnungsBoard } from "./modules/ZuordnungsBoard";
import { FuhrparkTab }     from "./modules/FuhrparkTab";
import { LagerTab }        from "./modules/LagerTab";
import { KITab }           from "./modules/KITab";

const MODULE_MAP: Record<number, ComponentType<any>> = {
  0: Dashboard, 1: MitarbeiterTab, 2: ZuordnungsBoard, 3: BaustellenTab,
  4: KalenderTab, 5: LagerTab, 6: FuhrparkTab, 7: KITab,
};

const fixArr = (val: any): any[] => {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  return val.split(",").map((s: string) => s.trim()).filter(Boolean);
};
const fixBS = (b: any) => ({
  ...b,
  anforderungen: fixArr(b.anforderungen),
  mitarbeiter:   fixArr(b.mitarbeiter),
  fahrzeuge:     fixArr(b.fahrzeuge),
  equipment:     fixArr(b.equipment),
  aufgaben:      Array.isArray(b.aufgaben) ? b.aufgaben : [],
});

export default function App() {
  const [tab,         setTab]         = useState(0);
  const [data,        setData]        = useState(INIT);
  const [modal,       setModal]       = useState<any>(null);
  const [detailMA,    setDetailMA]    = useState<any>(null);
  const [gpsStatus,   setGpsStatus]   = useState("Bereit");
  const [showPin,     setShowPin]     = useState(false);
  const [authed,      setAuthed]      = useState(false);
  const [appUnlocked, setAppUnlocked] = useState(false);
  const [hovered,     setHovered]     = useState(false); // ← Hover-State
  const APP_CODE = "bau2026";

  useEffect(() => {
    async function loadData() {
      const [ma, bs, fz, lg, tr] = await Promise.all([
        supabase.from("mitarbeiter").select("*"),
        supabase.from("baustellen").select("*"),
        supabase.from("fahrzeuge").select("*"),
        supabase.from("lager").select("*"),
        supabase.from("termine").select("*"),
      ]);
      setData({
        mitarbeiter: ma.data || [],
        baustellen:  bs.data ? bs.data.map(fixBS) : [],
        fahrzeuge:   fz.data || [],
        lager:       lg.data || [],
        termine:     Array.isArray(tr.data) ? tr.data : [],
      });
    }
    loadData();
  }, []);

  const today = new Date().toISOString().split("T")[0];
  const pflichtCount = (data.termine || []).filter((t: any) => t.art === "Pflichttermin" && t.datum >= today).length;

  const callAI = (prompt: string, setter: (s: string) => void, loadSetter: (b: boolean) => void) => {
    loadSetter(true); setter("");
    const ctx = "Bau-Logistik-Experte. Antworte auf Deutsch. Daten:" + JSON.stringify({ mitarbeiter: data.mitarbeiter, baustellen: data.baustellen, fahrzeuge: data.fahrzeuge, lager: data.lager, termine: data.termine });
    fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 800, system: ctx, messages: [{ role: "user", content: prompt }] }) })
      .then(r => r.json()).then(d => setter((d.content && d.content[0] && d.content[0].text) || "Keine Antwort.")).catch(e => setter("Fehler: " + e.message)).finally(() => loadSetter(false));
  };

  const saveTermin = async (d: any) => {
    if (d.id) { await supabase.from("termine").update(d).eq("id", d.id); setData((st: any) => ({ ...st, termine: st.termine.map((t: any) => t.id === d.id ? d : t) })); }
    else { const { data: neu } = await supabase.from("termine").insert([d]).select(); if (neu) setData((st: any) => ({ ...st, termine: [...(st.termine || []), neu[0]] })); }
  };
  const deleteTermin = async (id: number) => { await supabase.from("termine").delete().eq("id", id); setData((d: any) => ({ ...d, termine: d.termine.filter((t: any) => t.id !== id) })); };

  const openAdd = (type: string) => { const init = type === "baustellen" ? { mitarbeiter: [], fahrzeuge: [], equipment: [], aufgaben: [] } : {}; setModal({ type, mode: "add", initialForm: init }); };
  const openEdit = (type: string, item: any) => {
    const f = { ...item };
    if (type === "mitarbeiter") {
      f.qualifikationen = (item.qualifikationen || []).join(", "); f.fuehrerschein = (item.fuehrerschein || []).join(", ");
      f.gutMit = (item.gutMit || []).map((id: number) => { const m = data.mitarbeiter.find((x: any) => x.id === id); return m ? m.name : ""; }).join(", ");
      f.nichtMit = (item.nichtMit || []).map((id: number) => { const m = data.mitarbeiter.find((x: any) => x.id === id); return m ? m.name : ""; }).join(", ");
    }
    if (type === "baustellen") f.anforderungen = (item.anforderungen || []).join(", ");
    setModal({ type, mode: "edit", initialForm: f });
  };
  const closeModal = () => setModal(null);
  const pn = (str: string) => (str || "").split(",").map((s: string) => s.trim()).filter(Boolean).map((n: string) => { const m = data.mitarbeiter.find((x: any) => x.name.toLowerCase().includes(n.toLowerCase())); return m ? m.id : null; }).filter(Boolean);

  const saveItem = async (f: any) => {
    const { type, mode, initialForm } = modal; const id = initialForm.id; const p = { ...f };
    if (type === "mitarbeiter") { p.qualifikationen = f.qualifikationen ? f.qualifikationen.split(",").map((s: string) => s.trim()).filter(Boolean) : []; p.fuehrerschein = f.fuehrerschein ? f.fuehrerschein.split(",").map((s: string) => s.trim()).filter(Boolean) : []; p.stundenlohn = parseFloat(f.stundenlohn) || 0; p.urlaubstage = parseInt(f.urlaubstage) || 0; p.urlaubGenommen = parseInt(f.urlaubGenommen) || 0; p.gutMit = pn(f.gutMit); p.nichtMit = pn(f.nichtMit); }
    if (type === "baustellen") { p.anforderungen = f.anforderungen ? f.anforderungen.split(",").map((s: string) => s.trim()).filter(Boolean) : []; p.mitarbeiter = Array.isArray(p.mitarbeiter) ? p.mitarbeiter : []; p.fahrzeuge = Array.isArray(p.fahrzeuge) ? p.fahrzeuge : []; p.equipment = Array.isArray(p.equipment) ? p.equipment : []; p.aufgaben = Array.isArray(p.aufgaben) ? p.aufgaben : []; }
    if (mode === "add") { const { data: neu } = await supabase.from(type).insert([p]).select(); if (neu) setData((d: any) => { const n = { ...d }; const item = type === "baustellen" ? fixBS(neu[0]) : neu[0]; n[type] = [...(d[type] || []), item]; return n; }); }
    else { await supabase.from(type).update(p).eq("id", id); setData((d: any) => { const n = { ...d }; const item = type === "baustellen" ? fixBS({ ...p, id }) : { ...p, id }; n[type] = d[type].map((x: any) => x.id === id ? item : x); return n; }); }
    closeModal();
  };
  const deleteItem = async (type: string, id: number) => { await supabase.from(type).delete().eq("id", id); setData((d: any) => { const n = { ...d }; n[type] = d[type].filter((x: any) => x.id !== id); return n; }); };
  const simulateGPS = () => { setGpsStatus("Aktualisiere..."); setTimeout(() => { setData((d: any) => ({ ...d, fahrzeuge: d.fahrzeuge.map((f: any) => ({ ...f, lat: f.lat + (Math.random() - 0.5) * 0.008, lng: f.lng + (Math.random() - 0.5) * 0.008 })) })); setGpsStatus("Aktualisiert " + new Date().toLocaleTimeString("de-DE")); }, 800); };

  const ActiveModule = MODULE_MAP[tab];
  const navLabel = (NAV.find(n => n.id === tab) || { label: "Dashboard" }).label;
  const moduleProps = { data, setData, setTab, openAdd, openEdit, deleteItem, saveTermin, deleteTermin, callAI, simulateGPS, gpsStatus, onAdd: openAdd, onEdit: openEdit, onDelete: deleteItem, onDetail: setDetailMA };

  // ── Login ─────────────────────────────────────────────────────────────────────
  if (!appUnlocked) {
    return (
      <div style={{ fontFamily: "system-ui,sans-serif", height: "100vh", overflow: "hidden", background: "#f0f4f3", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ ...C.card, width: "min(360px,95vw)", textAlign: "center" }}>
          <div style={{ width: 52, height: 52, borderRadius: 12, background: ACCENT, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 700, color: "#fff", margin: "0 auto 16px" }}>BM</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#222", marginBottom: 4 }}>BauManager</div>
          <div style={{ fontSize: 12, color: "#aaa", marginBottom: 24 }}>Bitte Zugangscode eingeben</div>
          <input id="code-input" type="password" placeholder="Zugangscode" style={{ ...C.inp, textAlign: "center", fontSize: 16, letterSpacing: 4, marginBottom: 12 }} onKeyDown={e => { if (e.key === "Enter") { const v = (document.getElementById("code-input") as HTMLInputElement).value; if (v === APP_CODE) setAppUnlocked(true); } }} />
          <button style={{ ...C.btnP, width: "100%" }} onClick={() => { const v = (document.getElementById("code-input") as HTMLInputElement).value; if (v === APP_CODE) setAppUnlocked(true); }}>Einloggen</button>
        </div>
      </div>
    );
  }

  // Sidebar-Breite: schmal im Ruhezustand, breit bei Hover
  const SW = hovered ? 200 : 64;

  return (
    <div style={{ fontFamily: "system-ui,sans-serif", height: "100vh", overflow: "hidden", background: "#f0f4f3", display: "flex" }}>

      {/* ── SIDEBAR ───────────────────────────────────────────────────────────── */}
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          width: SW,
          minWidth: SW,
          background: ACCENT,
          height: "100vh",
          display: "flex",
          flexDirection: "column",
          padding: "16px 0",
          flexShrink: 0,
          // Sanfte Animation
          transition: "width 0.3s ease, min-width 0.3s ease",
          overflow: "hidden",
          zIndex: 10,
          // Schatten nur wenn offen
          boxShadow: hovered ? "4px 0 20px rgba(0,0,0,0.15)" : "none",
        }}
      >
        {/* Logo */}
        <div style={{ padding: "0 12px 20px", display: "flex", alignItems: "center", gap: 10, overflow: "hidden" }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#fff", flexShrink: 0 }}>BM</div>
          <div style={{ opacity: hovered ? 1 : 0, transition: "opacity 0.2s ease", whiteSpace: "nowrap", overflow: "hidden" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#fff" }}>BauManager</div>
            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.6)" }}>Pro</div>
          </div>
        </div>

        {/* Nav Items */}
        <div style={{ flex: 1 }}>
          {NAV.map(item => {
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setTab(item.id)}
                title={!hovered ? item.label : ""}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "11px 14px",
                  border: "none",
                  background: active ? "rgba(255,255,255,0.2)" : "transparent",
                  cursor: "pointer",
                  color: active ? "#fff" : "rgba(255,255,255,0.75)",
                  fontSize: 13,
                  fontWeight: active ? 600 : 400,
                  borderLeft: active ? "3px solid #fff" : "3px solid transparent",
                  boxSizing: "border-box",
                  width: "100%",
                  textAlign: "left",
                  transition: "background 0.15s",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                }}
              >
                {/* Icon – immer sichtbar */}
                <span style={{ fontSize: 17, flexShrink: 0 }}>{item.icon}</span>

                {/* Label – erscheint bei Hover */}
                <span style={{ opacity: hovered ? 1 : 0, transition: "opacity 0.2s ease", overflow: "hidden", flex: 1 }}>
                  {item.label}
                </span>

                {/* Badge */}
                {item.label === "Kalender" && pflichtCount > 0 && (
                  <span style={{
                    background: "#E24B4A", color: "#fff", borderRadius: 10,
                    fontSize: 10, padding: "1px 6px", fontWeight: 700, flexShrink: 0,
                    opacity: hovered ? 1 : 0,
                    transition: "opacity 0.2s ease",
                  }}>{pflichtCount}</span>
                )}
                {/* Badge als Punkt wenn eingeklappt */}
                {item.label === "Kalender" && pflichtCount > 0 && !hovered && (
                  <span style={{ position: "absolute", top: 8, right: 8, width: 8, height: 8, borderRadius: "50%", background: "#E24B4A" }} />
                )}
              </button>
            );
          })}
        </div>

        {/* Admin Button */}
        <div style={{ padding: "12px" }}>
          <button
            onClick={() => setShowPin(true)}
            title={!hovered ? (authed ? "Admin aktiv" : "Admin-Login") : ""}
            style={{
              width: "100%", padding: "7px 10px", borderRadius: 8,
              background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)",
              color: "#fff", cursor: "pointer", fontSize: 11,
              display: "flex", alignItems: "center", gap: 10,
              overflow: "hidden", whiteSpace: "nowrap",
            }}
          >
            <span style={{ flexShrink: 0 }}>🔑</span>
            <span style={{ opacity: hovered ? 1 : 0, transition: "opacity 0.2s ease" }}>
              {authed ? "Admin aktiv" : "Admin-Login"}
            </span>
          </button>
        </div>
      </div>

      {/* ── MAIN ──────────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>

        {/* Header */}
        <div style={{ padding: "12px 20px 10px", flexShrink: 0, borderBottom: "1px solid #e8eaed", background: "#f0f4f3" }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: "#222" }}>{navLabel}</div>
          <div style={{ fontSize: 11, color: "#bbb", marginTop: 1 }}>{new Date().toLocaleDateString("de-DE", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, minHeight: 0, overflow: "hidden", padding: 14 }}>
          {ActiveModule && <ActiveModule {...moduleProps} />}
        </div>
      </div>

      {/* ── OVERLAYS ──────────────────────────────────────────────────────────── */}
      {showPin && <PinModal onSuccess={() => { setAuthed(true); setShowPin(false); }} onCancel={() => setShowPin(false)} />}
      {modal && <EditModal modalType={modal.type} modalMode={modal.mode} initialForm={modal.initialForm} onSave={saveItem} onClose={closeModal} />}
      {detailMA && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.25)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }} onClick={e => { if (e.target === e.currentTarget) setDetailMA(null); }}>
          <div style={{ ...C.card, width: "min(500px,95vw)", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16, paddingBottom: 14, borderBottom: "1px solid #f5f5f5" }}>
              <div style={{ width: 52, height: 52, borderRadius: "50%", background: "#e8f5f3", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 700, color: ACCENT }}>{detailMA.name.split(" ").map((n: string) => n[0]).join("")}</div>
              <div><div style={{ fontWeight: 700, fontSize: 17, color: "#222" }}>{detailMA.name}</div><div style={{ fontSize: 13, color: "#aaa" }}>{detailMA.rolle}</div></div>
            </div>
            {[["Telefon", detailMA.telefon], ["Adresse", detailMA.adresse], ["Geburtsdatum", detailMA.geburtsdatum], ["Notfallkontakt", detailMA.notfallkontakt], ["Eintrittsdatum", detailMA.eintrittsdatum], ["Vertragsart", detailMA.vertragsart], ["Stundenlohn", detailMA.stundenlohn + " €/h"], ["Urlaub", (detailMA.urlaubGenommen || 0) + " / " + (detailMA.urlaubstage || 0) + " Tage"], ["Baustelle", detailMA.baustelle], ["Kategorie", detailMA.kategorie || autoKat(detailMA)], ["Zertifikate", detailMA.zertifikate], ["Bemerkungen", detailMA.bemerkungen]].map(row => {
              if (!row[1]) return null;
              return <div key={row[0]} style={{ display: "flex", gap: 12, padding: "7px 0", borderBottom: "1px solid #f5f5f5" }}><span style={{ fontSize: 12, color: "#bbb", minWidth: 110 }}>{row[0]}</span><span style={{ fontSize: 13, color: "#333" }}>{row[1]}</span></div>;
            })}
            <div style={{ padding: "10px 0 4px" }}><div style={{ fontSize: 12, color: "#bbb", marginBottom: 6 }}>Qualifikationen</div>{(detailMA.qualifikationen || []).map((q: string) => <span key={q} style={C.tag}>{q}</span>)}</div>
            <div style={{ padding: "4px 0" }}><div style={{ fontSize: 12, color: "#bbb", marginBottom: 6 }}>Führerschein</div>{(detailMA.fuehrerschein || []).map((f: string) => <span key={f} style={{ display: "inline-block", padding: "2px 8px", borderRadius: 10, fontSize: 11, background: "#e8f5f3", color: ACCENT, marginRight: 4, marginBottom: 2 }}>{f}</span>)}</div>
            {(detailMA.gutMit || []).length > 0 && <div style={{ padding: "4px 0" }}><div style={{ fontSize: 12, color: "#bbb", marginBottom: 6 }}>Gut mit</div>{detailMA.gutMit.map((id: number) => { const m = data.mitarbeiter.find((x: any) => x.id === id); return m ? <span key={id} style={{ display: "inline-block", padding: "2px 8px", borderRadius: 10, fontSize: 11, background: "#e8f5f3", color: ACCENT, marginRight: 4, marginBottom: 2 }}>{m.name}</span> : null; })}</div>}
            {(detailMA.nichtMit || []).length > 0 && <div style={{ padding: "4px 0 12px" }}><div style={{ fontSize: 12, color: "#bbb", marginBottom: 6 }}>Nicht mit</div>{detailMA.nichtMit.map((id: number) => { const m = data.mitarbeiter.find((x: any) => x.id === id); return m ? <span key={id} style={{ display: "inline-block", padding: "2px 8px", borderRadius: 10, fontSize: 11, background: "#fde8e8", color: "#E24B4A", marginRight: 4, marginBottom: 2 }}>{m.name}</span> : null; })}</div>}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
              <button style={C.btnS} onClick={() => setDetailMA(null)}>Schließen</button>
              <button style={C.btnP} onClick={() => { openEdit("mitarbeiter", detailMA); setDetailMA(null); }}>Bearbeiten</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

