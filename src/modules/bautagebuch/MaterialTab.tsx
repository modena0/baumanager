import { useState } from "react";
import { C, ACCENT } from "../../lib/constants";
import { supabase } from "../../lib/supabase";

const EINHEITEN = ["m³", "m²", "m", "t", "kg", "Stück", "l", "to", "Palette"];
const STATUS_LIST = ["geliefert", "verbaut", "gelagert"];

export function MaterialTab({ bsId, datum, eintragId, materialien, setMaterialien, currentUser, isMobile }: any) {
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);

  async function saveMaterial(m: any) {
    const p: any = {
      baustelle_id: bsId, datum,
      materialart: m.materialart,
      status: m.status || "geliefert",
      erstellt_von: currentUser?.name || "",
    };
    if (eintragId) p.eintrag_id = eintragId;
    if (m.menge !== undefined && m.menge !== "") p.menge = parseFloat(m.menge);
    if (m.einheit)         p.einheit         = m.einheit;
    if (m.einbauort)       p.einbauort       = m.einbauort;
    if (m.lv_position)     p.lv_position     = m.lv_position;
    if (m.lieferant)       p.lieferant       = m.lieferant;
    if (m.lieferschein_nr) p.lieferschein_nr = m.lieferschein_nr;
    if (m.lieferschein_foto) p.lieferschein_foto = m.lieferschein_foto;
    if (m.besonderheiten)  p.besonderheiten  = m.besonderheiten;

    if (m.id) {
      const { error } = await supabase.from("bautagebuch_material").update(p).eq("id", m.id);
      if (!error) setMaterialien((ms: any[]) => ms.map(x => x.id === m.id ? { ...p, id: m.id } : x));
    } else {
      const { data: neu, error } = await supabase.from("bautagebuch_material").insert([p]).select().single();
      if (!error && neu) setMaterialien((ms: any[]) => [...ms, { ...p, id: neu.id }]);
      else if (error) alert("Fehler: " + error.message);
    }
    setShowForm(false); setEditItem(null);
  }

  async function deleteMaterial(id: number) {
    await supabase.from("bautagebuch_material").delete().eq("id", id);
    setMaterialien((ms: any[]) => ms.filter(m => m.id !== id));
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <span style={{ fontSize: 13, color: "#888" }}>{materialien.length} Einträge heute</span>
        <button style={C.btnP} onClick={() => { setEditItem({ baustelle_id: bsId, datum, materialart: "", status: "geliefert" }); setShowForm(true); }}>
          + Material erfassen
        </button>
      </div>

      {materialien.length === 0 && (
        <div style={{ ...C.card, textAlign: "center", padding: 32, color: "#bbb" }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>📦</div>
          Noch kein Material – auch Sascha kann Material automatisch erfassen!
        </div>
      )}

      {materialien.map((m: any) => (
        <div key={m.id} style={{ ...C.card, marginBottom: 10, padding: "14px 16px", borderLeft: m.erstellt_von === "Sascha KI" ? "3px solid #9C27B0" : "none" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
            <div>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: "#222" }}>{m.materialart}</span>
                {m.erstellt_von === "Sascha KI" && <span style={{ fontSize: 9, background: "#f3e5f5", color: "#9C27B0", padding: "1px 5px", borderRadius: 4, fontWeight: 600 }}>✦ Sascha</span>}
              </div>
              {(m.menge || m.einheit) && <div style={{ fontSize: 12, color: ACCENT, marginTop: 2 }}>{m.menge} {m.einheit}</div>}
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 8, fontWeight: 600, background: m.status === "verbaut" ? "#e8f5f3" : m.status === "gelagert" ? "#fff3e0" : "#f0f4f3", color: m.status === "verbaut" ? ACCENT : m.status === "gelagert" ? "#BA7517" : "#888" }}>
                {m.status}
              </span>
              <button onClick={() => { setEditItem(m); setShowForm(true); }} style={{ padding: "3px 8px", borderRadius: 6, border: "1px solid #eee", background: "#fff", cursor: "pointer", fontSize: 11 }}>✎</button>
              <button onClick={() => deleteMaterial(m.id)} style={{ padding: "3px 8px", borderRadius: 6, border: "none", background: "#E24B4A18", cursor: "pointer", fontSize: 11, color: "#E24B4A" }}>✕</button>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr 1fr 1fr", gap: 8, fontSize: 11, color: "#666" }}>
            {m.einbauort       && <div><span style={{ color: "#aaa" }}>Einbauort: </span>{m.einbauort}</div>}
            {m.lv_position     && <div><span style={{ color: "#aaa" }}>LV-Pos: </span>{m.lv_position}</div>}
            {m.lieferant       && <div><span style={{ color: "#aaa" }}>Lieferant: </span>{m.lieferant}</div>}
            {m.lieferschein_nr && <div><span style={{ color: "#aaa" }}>LS-Nr: </span>{m.lieferschein_nr}</div>}
          </div>
          {m.besonderheiten && <div style={{ marginTop: 6, padding: "6px 10px", background: "#fff8e1", borderRadius: 8, fontSize: 11, color: "#BA7517" }}>⚠ {m.besonderheiten}</div>}
        </div>
      ))}

      {showForm && editItem && (
        <MaterialFormular m={editItem} isMobile={isMobile} onSave={saveMaterial} onClose={() => { setShowForm(false); setEditItem(null); }} />
      )}
    </div>
  );
}

function MaterialFormular({ m, isMobile, onSave, onClose }: any) {
  const [f, setF] = useState({ ...m });

  async function lsFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement("canvas");
        let w = img.width, h = img.height;
        if (w > 600) { h = h * 600 / w; w = 600; }
        c.width = w; c.height = h;
        c.getContext("2d")?.drawImage(img, 0, 0, w, h);
        setF((x: any) => ({ ...x, lieferschein_foto: c.toDataURL("image/jpeg", 0.6) }));
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: isMobile ? "flex-end" : "center", justifyContent: "center", zIndex: 9999 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ ...C.card, width: isMobile ? "100%" : "min(560px,95vw)", maxHeight: "92vh", overflowY: "auto", borderRadius: isMobile ? "20px 20px 0 0" : 16, padding: isMobile ? "20px 16px 32px" : 24, margin: 0 }}>
        {isMobile && <div style={{ width: 40, height: 4, background: "#ddd", borderRadius: 2, margin: "0 auto 16px" }} />}
        <div style={{ fontSize: 16, fontWeight: 700, color: "#222", marginBottom: 16, paddingBottom: 12, borderBottom: "1px solid #f5f5f5" }}>
          {m.id ? "Material bearbeiten" : "Material erfassen"}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "2fr 1fr", gap: 10 }}>
          <div><label style={C.lbl}>Materialart *</label><input style={C.inp} value={f.materialart || ""} onChange={e => setF((x: any) => ({ ...x, materialart: e.target.value }))} placeholder="z.B. Beton C25/30" /></div>
          <div><label style={C.lbl}>Status</label><select style={C.inp} value={f.status || "geliefert"} onChange={e => setF((x: any) => ({ ...x, status: e.target.value }))}>{STATUS_LIST.map(s => <option key={s}>{s}</option>)}</select></div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div><label style={C.lbl}>Menge</label><input type="number" style={C.inp} value={f.menge || ""} onChange={e => setF((x: any) => ({ ...x, menge: e.target.value }))} /></div>
          <div><label style={C.lbl}>Einheit</label><select style={C.inp} value={f.einheit || ""} onChange={e => setF((x: any) => ({ ...x, einheit: e.target.value }))}><option value="">--</option>{EINHEITEN.map(e => <option key={e}>{e}</option>)}</select></div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10 }}>
          <div><label style={C.lbl}>Einbauort</label><input style={C.inp} value={f.einbauort || ""} onChange={e => setF((x: any) => ({ ...x, einbauort: e.target.value }))} placeholder="z.B. Schacht 3" /></div>
          <div><label style={C.lbl}>LV-Position</label><input style={C.inp} value={f.lv_position || ""} onChange={e => setF((x: any) => ({ ...x, lv_position: e.target.value }))} placeholder="z.B. 3.2.1" /></div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10 }}>
          <div><label style={C.lbl}>Lieferant</label><input style={C.inp} value={f.lieferant || ""} onChange={e => setF((x: any) => ({ ...x, lieferant: e.target.value }))} /></div>
          <div><label style={C.lbl}>Lieferschein-Nr.</label><input style={C.inp} value={f.lieferschein_nr || ""} onChange={e => setF((x: any) => ({ ...x, lieferschein_nr: e.target.value }))} /></div>
        </div>
        <div><label style={C.lbl}>Lieferschein Foto</label>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <label style={{ ...C.btnS, cursor: "pointer", fontSize: 12 }}>📷 Foto<input type="file" accept="image/*" style={{ display: "none" }} onChange={lsFoto} /></label>
            {f.lieferschein_foto && <img src={f.lieferschein_foto} style={{ height: 48, borderRadius: 6, border: "1px solid #eee" }} />}
          </div>
        </div>
        <div><label style={C.lbl}>Besonderheiten</label><textarea rows={2} style={{ ...C.inp, resize: "vertical" as any, fontFamily: "system-ui" }} value={f.besonderheiten || ""} onChange={e => setF((x: any) => ({ ...x, besonderheiten: e.target.value }))} /></div>
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button style={{ ...C.btnS, flex: 1 }} onClick={onClose}>Abbrechen</button>
          <button style={{ ...C.btnP, flex: 1, opacity: !f.materialart ? 0.5 : 1 }} onClick={() => { if (f.materialart) onSave(f); }}>Speichern</button>
        </div>
      </div>
    </div>
  );
}
