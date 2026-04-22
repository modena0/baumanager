import { useState, useEffect } from "react";
import type { ComponentType } from "react";
import { NAV, INIT, C, ACCENT } from "./lib/constants";
import { autoKat } from "./lib/utils";
import { supabase } from "./lib/supabase";
import { EditModal }       from "./components/EditModal";
import { PinModal }        from "./components/PinModal";
import { LoginScreen }     from "./loginscreen";
import { Dashboard }       from "./modules/Dashboard";
import { MitarbeiterTab }  from "./modules/MitarbeiterTab";
import { BaustellenTab }   from "./modules/BaustellenTab";
import { KalenderTab }     from "./modules/KalenderTab";
import { ZuordnungsBoard } from "./modules/ZuordnungsBoard";
import { FuhrparkTab }     from "./modules/FuhrparkTab";
import { LagerTab }        from "./modules/LagerTab";
import { KITab }           from "./modules/KITab";
import { ROLLE_TABS, KANN } from "./rollen";
import type { Rolle } from "./rollen";

const MODULE_MAP: Record<number, ComponentType<any>> = {
  0: Dashboard, 1: MitarbeiterTab, 2: ZuordnungsBoard, 3: BaustellenTab,
  4: KalenderTab, 5: LagerTab, 6: FuhrparkTab, 7: KITab,
};

// ── Hilfsfunktionen ────────────────────────────────────────────────────────────
const toArr = (v: any): any[] => {
  if (!v) return [];
  if (Array.isArray(v)) return v;
  return String(v).split(",").map((s: string) => s.trim()).filter(Boolean);
};

const fixBS = (b: any) => ({
  ...b,
  anforderungen: toArr(b.anforderungen),
  mitarbeiter:   toArr(b.mitarbeiter),
  fahrzeuge:     toArr(b.fahrzeuge),
  equipment:     toArr(b.equipment),
  aufgaben:      Array.isArray(b.aufgaben) ? b.aufgaben : [],
});

export default function App() {
  const [tab,         setTab]         = useState(0);
  const [data,        setData]        = useState(INIT);
  const [modal,       setModal]       = useState<any>(null);
  const [detailMA,    setDetailMA]    = useState<any>(null);
  const [gpsStatus,   setGpsStatus]   = useState("Bereit");
  const [showPin,     setShowPin]     = useState(false);
  const [hovered,     setHovered]     = useState(false);
  const [selectedBS,  setSelectedBS]  = useState<number|null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [dataLoaded,  setDataLoaded]  = useState(false);

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
      setDataLoaded(true);
    }
    loadData();
  }, []);

  const rolle: Rolle = (currentUser?.rolle_system as Rolle) || "admin";
  const erlaubteTabs = ROLLE_TABS[rolle] || ROLLE_TABS.admin;

  useEffect(() => {
    if (!erlaubteTabs.includes(tab)) setTab(erlaubteTabs[0]);
  }, [rolle]);

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

  const openAdd = (type: string) => {
    const init = type === "baustellen" ? { mitarbeiter: [], fahrzeuge: [], equipment: [], aufgaben: [] } : {};
    setModal({ type, mode: "add", initialForm: init });
  };

  const openEdit = (type: string, item: any) => {
    const f = { ...item };
    if (type === "mitarbeiter") {
      // Sicherstellen dass alle Arrays wirklich Arrays sind
      f.qualifikationen = toArr(item.qualifikationen).join(", ");
      f.fuehrerschein   = toArr(item.fuehrerschein).join(", ");
      f.gutMit   = toArr(item.gutMit).map((id: number) => { const m = data.mitarbeiter.find((x: any) => x.id === id); return m ? m.name : ""; }).filter(Boolean).join(", ");
      f.nichtMit = toArr(item.nichtMit).map((id: number) => { const m = data.mitarbeiter.find((x: any) => x.id === id); return m ? m.name : ""; }).filter(Boolean).join(", ");
    }
    if (type === "baustellen") f.anforderungen = toArr(item.anforderungen).join(", ");
    setModal({ type, mode: "edit", initialForm: f });
  };

  const closeModal = () => setModal(null);

  const pn = (str: string) =>
    (str || "").split(",").map((s: string) => s.trim()).filter(Boolean)
      .map((n: string) => { const m = data.mitarbeiter.find((x: any) => x.name.toLowerCase().includes(n.toLowerCase())); return m ? m.id : null; })
      .filter(Boolean);

  const saveItem = async (f: any) => {
    const { type, mode, initialForm } = modal; const id = initialForm.id; const p = { ...f };
    if (type === "mitarbeiter") {
      p.qualifikationen = f.qualifikationen ? f.qualifikationen.split(",").map((s: string) => s.trim()).filter(Boolean) : [];
      p.fuehrerschein   = f.fuehrerschein   ? f.fuehrerschein.split(",").map((s: string) => s.trim()).filter(Boolean) : [];
      p.stundenlohn     = parseFloat(f.stundenlohn) || 0;
      p.urlaubstage     = parseInt(f.urlaubstage)   || 0;
      p.urlaubGenommen  = parseInt(f.urlaubGenommen) || 0;
      p.gutMit   = pn(f.gutMit);
      p.nichtMit = pn(f.nichtMit);
    }
    if (type === "baustellen") {
      p.anforderungen = f.anforderungen ? f.anforderungen.split(",").map((s: string) => s.trim()).filter(Boolean) : [];
      p.mitarbeiter   = Array.isArray(p.mitarbeiter) ? p.mitarbeiter : [];
      p.fahrzeuge     = Array.isArray(p.fahrzeuge)   ? p.fahrzeuge   : [];
      p.equipment     = Array.isArray(p.equipment)   ? p.equipment   : [];
      p.aufgaben      = Array.isArray(p.aufgaben)    ? p.aufgaben    : [];
    }
    if (mode === "add") {
      const { data: neu } = await supabase.from(type).insert([p]).select();
      if (neu) setData((d: any) => { const n = { ...d }; const item = type === "baustellen" ? fixBS(neu[0]) : neu[0]; n[type] = [...(d[type] || []), item]; return n; });
    } else {
      await supabase.from(type).update(p).eq("id", id);
      setData((d: any) => { const n = { ...d }; const item = type === "baustellen" ? fixBS({ ...p, id }) : { ...p, id }; n[type] = d[type].map((x: any) => x.id === id ? item : x); return n; });
    }
    closeModal();
  };

  const deleteItem = async (type: string, id: number) => {
    await supabase.from(type).delete().eq("id", id);
    setData((d: any) => { const n = { ...d }; n[type] = d[type].filter((x: any) => x.id !== id); return n; });
  };

  const simulateGPS = () => {
    setGpsStatus("Aktualisiere...");
    setTimeout(() => {
      setData((d: any) => ({ ...d, fahrzeuge: d.fahrzeuge.map((f: any) => ({ ...f, lat: f.lat + (Math.random() - 0.5) * 0.008, lng: f.lng + (Math.random() - 0.5) * 0.008 })) }));
      setGpsStatus("Aktualisiert " + new Date().toLocaleTimeString("de-DE"));
    }, 800);
  };

  // ── Ladescreen ────────────────────────────────────────────────────────────────
  if (!dataLoaded) {
    return (
      <div style={{ fontFamily: "system-ui,sans-serif", height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f0f4f3" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: ACCENT, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 700, color: "#fff", margin: "0 auto 16px" }}>BM</div>
          <div style={{ fontSize: 13, color: "#bbb" }}>Lädt...</div>
        </div>
      </div>
    );
  }

  // ── Login Screen ──────────────────────────────────────────────────────────────
  if (!currentUser) {
    return <LoginScreen mitarbeiter={data.mitarbeiter} onLogin={(user: any) => setCurrentUser(user)} />;
  }

  // ── Hauptapp ──────────────────────────────────────────────────────────────────
  const ActiveModule = MODULE_MAP[tab];
  const navLabel = (NAV.find(n => n.id === tab) || { label: "Dashboard" }).label;

  const moduleProps = {
    data, setData, setTab,
    openAdd, openEdit, deleteItem,
    saveTermin, deleteTermin,
    callAI, simulateGPS, gpsStatus,
    onAdd: openAdd, onEdit: openEdit, onDelete: deleteItem,
    onDetail: setDetailMA,
    selectedBS: selectedBS || (rolle === "baustellen_leitung" ? currentUser.id : null),
    setSelectedBS,
    rolle, currentUser,
    kannLohnSehen:         KANN.lohnSehen(rolle),
    kannMitarbeiterEdit:   KANN.mitarbeiterEdit(rolle),
    kannBaustellenAnlegen: KANN.baustellenAnlegen(rolle),
  };

  return (
    <div style={{ fontFamily: "system-ui,sans-serif", height: "100vh", overflow: "hidden", background: "#f0f4f3", display: "flex" }}>

      {/* ── SIDEBAR ───────────────────────────────────────────────────────────── */}
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{ width: hovered ? 200 : 64, minWidth: hovered ? 200 : 64, background: ACCENT, height: "100vh", display: "flex", flexDirection: "column", padding: "16px 0", flexShrink: 0, transition: "width 0.3s ease, min-width 0.3s ease", overflow: "hidden", zIndex: 10, boxShadow: hovered ? "4px 0 20px rgba(0,0,0,0.15)" : "none" }}
      >
        {/* Logo + User */}
        <div style={{ padding: "0 12px 20px", display: "flex", alignItems: "center", gap: 10, overflow: "hidden" }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#fff", flexShrink: 0 }}>BM</div>
          <div style={{ opacity: hovered ? 1 : 0, transition: "opacity 0.2s ease", whiteSpace: "nowrap" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#fff" }}>{currentUser.name}</div>
            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.7)" }}>{currentUser.rolle_system}</div>
          </div>
        </div>

        {/* Nav */}
        <div style={{ flex: 1 }}>
          {NAV.filter(item => erlaubteTabs.includes(item.id)).map(item => {
            const active = tab === item.id;
            return (
              <div key={item.id} style={{ position: "relative" }} title={!hovered ? item.label : ""}>
                <button onClick={() => setTab(item.id)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", border: "none", background: active ? "rgba(255,255,255,0.2)" : "transparent", cursor: "pointer", color: active ? "#fff" : "rgba(255,255,255,0.75)", fontSize: 13, fontWeight: active ? 600 : 400, borderLeft: active ? "3px solid #fff" : "3px solid transparent", boxSizing: "border-box", width: "100%", whiteSpace: "nowrap", overflow: "hidden" }}>
                  <span style={{ fontSize: 17, flexShrink: 0 }}>{item.icon}</span>
                  <span style={{ opacity: hovered ? 1 : 0, transition: "opacity 0.2s ease", flex: 1 }}>{item.label}</span>
                  {item.label === "Kalender" && pflichtCount > 0 && hovered && <span style={{ background: "#E24B4A", color: "#fff", borderRadius: 10, fontSize: 10, padding: "1px 6px", fontWeight: 700 }}>{pflichtCount}</span>}
                </button>
                {item.label === "Kalender" && pflichtCount > 0 && !hovered && <span style={{ position: "absolute", top: 8, right: 10, width: 7, height: 7, borderRadius: "50%", background: "#E24B4A", pointerEvents: "none" }} />}
              </div>
            );
          })}
        </div>

        {/* Abmelden */}
        <div style={{ padding: "12px" }}>
          <button onClick={() => setCurrentUser(null)} title={!hovered ? "Abmelden" : ""}
            style={{ width: "100%", padding: "7px 10px", borderRadius: 8, background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)", color: "#fff", cursor: "pointer", fontSize: 11, display: "flex", alignItems: "center", gap: 10, overflow: "hidden", whiteSpace: "nowrap" }}
          >
            <span style={{ flexShrink: 0 }}>🚪</span>
            <span style={{ opacity: hovered ? 1 : 0, transition: "opacity 0.2s ease" }}>Abmelden</span>
          </button>
        </div>
      </div>

      {/* ── MAIN ──────────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
        <div style={{ padding: "12px 20px 10px", flexShrink: 0, borderBottom: "1px solid #e8eaed", background: "#f0f4f3", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: "#222" }}>{navLabel}</div>
            <div style={{ fontSize: 11, color: "#bbb", marginTop: 1 }}>{new Date().toLocaleDateString("de-DE", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</div>
          </div>
          <div style={{ background: ACCENT + "22", color: ACCENT, borderRadius: 20, padding: "4px 12px", fontSize: 11, fontWeight: 600 }}>
            {currentUser.name} · {currentUser.rolle_system}
          </div>
        </div>
        <div style={{ flex: 1, minHeight: 0, overflow: "hidden", padding: 14 }}>
          {ActiveModule && <ActiveModule {...moduleProps} />}
        </div>
      </div>

      {/* ── OVERLAYS ──────────────────────────────────────────────────────────── */}
      {showPin && <PinModal onSuccess={() => setShowPin(false)} onCancel={() => setShowPin(false)} />}
      {modal && <EditModal modalType={modal.type} modalMode={modal.mode} initialForm={modal.initialForm} onSave={saveItem} onClose={closeModal} />}

      {detailMA && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.25)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }} onClick={e => { if (e.target === e.currentTarget) setDetailMA(null); }}>
          <div style={{ ...C.card, width: "min(500px,95vw)", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16, paddingBottom: 14, borderBottom: "1px solid #f5f5f5" }}>
              <div style={{ width: 52, height: 52, borderRadius: "50%", background: "#e8f5f3", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 700, color: ACCENT }}>{detailMA.name.split(" ").map((n: string) => n[0]).join("")}</div>
              <div><div style={{ fontWeight: 700, fontSize: 17, color: "#222" }}>{detailMA.name}</div><div style={{ fontSize: 13, color: "#aaa" }}>{detailMA.rolle}</div></div>
            </div>
            {([
              ["Telefon", detailMA.telefon], ["Adresse", detailMA.adresse], ["Geburtsdatum", detailMA.geburtsdatum],
              ["Notfallkontakt", detailMA.notfallkontakt], ["Eintrittsdatum", detailMA.eintrittsdatum], ["Vertragsart", detailMA.vertragsart],
              ...(KANN.lohnSehen(rolle) ? [["Stundenlohn", detailMA.stundenlohn + " €/h"]] : []),
              ["Urlaub", (detailMA.urlaubGenommen || 0) + " / " + (detailMA.urlaubstage || 0) + " Tage"],
              ["Baustelle", detailMA.baustelle], ["Kategorie", detailMA.kategorie || autoKat(detailMA)],
              ["Zertifikate", detailMA.zertifikate], ["Bemerkungen", detailMA.bemerkungen],
            ] as [string, any][]).map(([label, val]) => {
              if (!val) return null;
              return <div key={label} style={{ display: "flex", gap: 12, padding: "7px 0", borderBottom: "1px solid #f5f5f5" }}><span style={{ fontSize: 12, color: "#bbb", minWidth: 110 }}>{label}</span><span style={{ fontSize: 13, color: "#333" }}>{val}</span></div>;
            })}
            <div style={{ padding: "10px 0 4px" }}>
              <div style={{ fontSize: 12, color: "#bbb", marginBottom: 6 }}>Qualifikationen</div>
              {toArr(detailMA.qualifikationen).map((q: string) => <span key={q} style={C.tag}>{q}</span>)}
            </div>
            <div style={{ padding: "4px 0" }}>
              <div style={{ fontSize: 12, color: "#bbb", marginBottom: 6 }}>Führerschein</div>
              {toArr(detailMA.fuehrerschein).map((f: string) => <span key={f} style={{ display: "inline-block", padding: "2px 8px", borderRadius: 10, fontSize: 11, background: "#e8f5f3", color: ACCENT, marginRight: 4, marginBottom: 2 }}>{f}</span>)}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
              <button style={C.btnS} onClick={() => setDetailMA(null)}>Schließen</button>
              {KANN.mitarbeiterEdit(rolle) && <button style={C.btnP} onClick={() => { openEdit("mitarbeiter", detailMA); setDetailMA(null); }}>Bearbeiten</button>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
