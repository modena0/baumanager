import { useState } from "react";
import { C, ACCENT, BS_KAT } from "../../lib/constants";
import { BauablaufAnalyse } from "./BauablaufAnalyse";

interface Props {
  onSave: (data: any) => void;
  onClose: () => void;
  isMobile: boolean;
}

const INIT = {
  name: "", ort: "", kategorie: "Tiefbau", beschreibung: "",
  status: "geplant", start: "", ende: "", anforderungen: "",
};

export function NeuerBaustellenDialog({ onSave, onClose, isMobile }: Props) {
  const [schritt, setSchritt] = useState<"form" | "analyse">("form");
  const [form,    setForm]    = useState(INIT);

  const upd = (field: string) => (e: any) => setForm(f => ({ ...f, [field]: e.target.value }));

  function weiter() {
    if (!form.name.trim()) return;
    setSchritt("analyse");
  }

  // Baut das fertige Objekt und ruft onSave genau EINMAL auf
  function speichern(aufgaben: any[] = []) {
    const p: any = {
      ...form,
      anforderungen: form.anforderungen
        ? form.anforderungen.split(",").map((s: string) => s.trim()).filter(Boolean)
        : [],
      mitarbeiter: [],
      fahrzeuge: [],
      equipment: [],
      aufgaben,
      start: form.start || null,
      ende: form.ende || null,
    };
    onSave(p);
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: isMobile ? "flex-end" : "center", justifyContent: "center", zIndex: 9999 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ ...C.card, width: isMobile ? "100%" : "min(560px,95vw)", maxHeight: isMobile ? "95vh" : "90vh", overflowY: "auto", borderRadius: isMobile ? "20px 20px 0 0" : 16, padding: isMobile ? "20px 16px 32px" : 24, margin: 0 }}>

        {isMobile && <div style={{ width: 40, height: 4, background: "#ddd", borderRadius: 2, margin: "0 auto 16px" }} />}

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, paddingBottom: 12, borderBottom: "1px solid #f5f5f5" }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: "#222" }}>
            {schritt === "form" ? "⛏ Neue Baustelle" : "📋 Bauablaufplan"}
          </div>
          {schritt === "analyse" && (
            <button onClick={() => setSchritt("form")}
              style={{ fontSize: 12, color: "#888", background: "none", border: "none", cursor: "pointer" }}>
              ← Zurück
            </button>
          )}
        </div>

        {schritt === "form" && (
          <div>
            <label style={C.lbl}>Name *</label>
            <input style={C.inp} value={form.name} onChange={upd("name")} placeholder="z.B. Anbindung Wielandstraße" autoFocus />
            <label style={C.lbl}>Ort / Adresse</label>
            <input style={C.inp} value={form.ort} onChange={upd("ort")} placeholder="z.B. Budapester Straße, Dresden" />
            <label style={C.lbl}>Kategorie</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
              {BS_KAT.map(k => (
                <button key={k} onClick={() => setForm(f => ({ ...f, kategorie: k }))}
                  style={{ padding: "6px 14px", borderRadius: 20, border: "1.5px solid " + (form.kategorie === k ? ACCENT : "#e8eaed"), background: form.kategorie === k ? "#e8f5f3" : "#fff", color: form.kategorie === k ? ACCENT : "#888", cursor: "pointer", fontSize: 12, fontWeight: form.kategorie === k ? 600 : 400 }}>
                  {k}
                </button>
              ))}
            </div>
            <label style={C.lbl}>Status</label>
            <select style={C.inp} value={form.status} onChange={upd("status")}>
              {["geplant", "aktiv", "pausiert", "abgeschlossen"].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div><label style={C.lbl}>Start</label><input type="date" style={C.inp} value={form.start} onChange={upd("start")} /></div>
              <div><label style={C.lbl}>Ende</label><input type="date" style={C.inp} value={form.ende} onChange={upd("ende")} /></div>
            </div>
            <label style={C.lbl}>Beschreibung</label>
            <input style={C.inp} value={form.beschreibung} onChange={upd("beschreibung")} placeholder="Kurze Projektbeschreibung" />
            <label style={C.lbl}>Anforderungen (kommagetrennt)</label>
            <input style={C.inp} value={form.anforderungen} onChange={upd("anforderungen")} placeholder="z.B. Führerschein C, Tiefbau" />
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button style={{ ...C.btnS, flex: 1 }} onClick={onClose}>Abbrechen</button>
              <button onClick={weiter} disabled={!form.name.trim()}
                style={{ ...C.btnP, flex: 1, opacity: !form.name.trim() ? 0.5 : 1 }}>
                Weiter →
              </button>
            </div>
          </div>
        )}

        {schritt === "analyse" && (
          <BauablaufAnalyse
            onAufgaben={(aufgaben) => speichern(aufgaben)}
            onSkip={() => speichern([])}
          />
        )}
      </div>
    </div>
  );
}
