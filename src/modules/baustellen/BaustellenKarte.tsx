import { useState } from "react";
import { ACCENT, C } from "../../lib/constants";
import { getProgress, pill } from "../../lib/utils";
import { supabase } from "../../lib/supabase";

interface Props {
  b: any;
  data: any;
  setData: any;
  isExp: boolean;
  onToggleExp: () => void;
  onEdit: () => void;
  onDelete: () => void;
  isBauleitung: boolean;
  kolumnen: any[];
}

const toNumArr = (arr: any): number[] =>
  (Array.isArray(arr) ? arr : []).map((i: any) => Number(i)).filter((i: number) => !isNaN(i));

// Inline AufgabenPanel um Import-Probleme zu vermeiden
function AufgabenPanel({ b, setData }: { b: any; setData: any }) {
  const [neu,      setNeu]      = useState("");
  const [neuPhase, setNeuPhase] = useState("");
  const [neuVon,   setNeuVon]   = useState("");
  const [neuBis,   setNeuBis]   = useState("");
  const [editId,   setEditId]   = useState<number | null>(null);
  const [editData, setEditData] = useState<any>({});
  const [showForm, setShowForm] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const auf = Array.isArray(b.aufgaben) ? b.aufgaben : [];
  const done = auf.filter((a: any) => a.erledigt).length;
  const prog = auf.length > 0 ? Math.round(done / auf.length * 100) : 0;

  async function updBS(newAufgaben: any[]) {
    await supabase.from("baustellen").update({ aufgaben: newAufgaben }).eq("id", b.id);
    setData((d: any) => ({
      ...d,
      baustellen: d.baustellen.map((x: any) => x.id === b.id ? { ...x, aufgaben: newAufgaben } : x),
    }));
  }

  function toggle(id: number) {
    updBS(auf.map((a: any) => a.id === id ? { ...a, erledigt: !a.erledigt } : a));
  }
  function del(id: number) { updBS(auf.filter((a: any) => a.id !== id)); }

  function add() {
    if (!neu.trim()) return;
    const nid = Math.max(0, ...auf.map((a: any) => a.id)) + 1;
    updBS([...auf, { id: nid, titel: neu.trim(), erledigt: false, bauphase: neuPhase.trim() || null, datum_von: neuVon || null, datum_bis: neuBis || null }]);
    setNeu(""); setNeuPhase(""); setNeuVon(""); setNeuBis(""); setShowForm(false);
  }

  function saveEdit() {
    updBS(auf.map((a: any) => a.id === editId ? { ...a, titel: editData.titel, bauphase: editData.bauphase || null, datum_von: editData.datum_von || null, datum_bis: editData.datum_bis || null } : a));
    setEditId(null);
  }

  const COLORS = ["#4DB6AC","#378ADD","#BA7517","#E24B4A","#9C27B0","#1D9E75","#607D8B"];
  function col(phase: string) { let h = 0; for (let i = 0; i < phase.length; i++) h = phase.charCodeAt(i) + ((h << 5) - h); return COLORS[Math.abs(h) % COLORS.length]; }
  function fmt(d: string) { return new Date(d).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" }); }

  // Gruppieren
  const phasenOrder: string[] = [];
  const phasen: Record<string, any[]> = {};
  for (const a of auf) {
    const key = a.bauphase || "Ohne Bauphase";
    if (!phasen[key]) { phasen[key] = []; phasenOrder.push(key); }
    phasen[key].push(a);
  }

  return (
    <div style={{ borderTop: "1px solid #e8f5f3", padding: "14px 16px", background: "#f8fffe" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: "#555" }}>Aufgaben</span>
        <div style={{ flex: 1, height: 6, background: "#e0e0e0", borderRadius: 3 }}>
          <div style={{ height: "100%", width: prog + "%", background: ACCENT, borderRadius: 3 }} />
        </div>
        <span style={{ fontSize: 13, fontWeight: 700, color: ACCENT }}>{prog}%</span>
        <span style={{ fontSize: 11, color: "#bbb" }}>{done}/{auf.length}</span>
      </div>

      {phasenOrder.map(phase => {
        const aufgaben = phasen[phase];
        const c = col(phase);
        const isOpen = !collapsed[phase];
        const pDone = aufgaben.filter((a: any) => a.erledigt).length;
        const pProg = aufgaben.length > 0 ? Math.round(pDone / aufgaben.length * 100) : 0;
        const mitDatum = aufgaben.find((a: any) => a.datum_von);
        const datumLabel = mitDatum?.datum_von ? fmt(mitDatum.datum_von) + (mitDatum.datum_bis ? "–" + fmt(mitDatum.datum_bis) : "") : null;

        return (
          <div key={phase} style={{ marginBottom: 6, borderRadius: 10, overflow: "hidden", border: "1px solid " + c + "33" }}>
            <div onClick={() => setCollapsed(x => ({ ...x, [phase]: !x[phase] }))}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", background: c + "12", cursor: "pointer" }}>
              <div style={{ width: 4, height: 16, borderRadius: 2, background: c }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: c, flex: 1 }}>{phase}</span>
              {datumLabel && <span style={{ fontSize: 10, color: "#888", background: "#fff", padding: "1px 7px", borderRadius: 6, border: "1px solid #eee" }}>📅 {datumLabel}</span>}
              <span style={{ fontSize: 10, color: c + "99" }}>{pDone}/{aufgaben.length}</span>
              <div style={{ width: 40, height: 4, background: "#e0e0e0", borderRadius: 2 }}>
                <div style={{ height: "100%", width: pProg + "%", background: c, borderRadius: 2 }} />
              </div>
              <span style={{ fontSize: 12, color: c, transform: isOpen ? "rotate(90deg)" : "none", display: "inline-block" }}>›</span>
            </div>

            {isOpen && (
              <div style={{ background: "#fff" }}>
                {aufgaben.map((a: any) => (
                  <div key={a.id}>
                    {editId === a.id ? (
                      <div style={{ padding: "10px 12px", borderBottom: "1px solid #f0f0f0" }}>
                        <input value={editData.titel} onChange={e => setEditData((x: any) => ({ ...x, titel: e.target.value }))} style={{ ...C.inp, marginBottom: 6, fontSize: 12 }} />
                        <input value={editData.bauphase} onChange={e => setEditData((x: any) => ({ ...x, bauphase: e.target.value }))} style={{ ...C.inp, marginBottom: 6, fontSize: 12 }} placeholder="Bauphase" />
                        <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                          <input type="date" value={editData.datum_von} onChange={e => setEditData((x: any) => ({ ...x, datum_von: e.target.value }))} style={{ ...C.inp, marginBottom: 0, fontSize: 12, flex: 1 }} />
                          <input type="date" value={editData.datum_bis} onChange={e => setEditData((x: any) => ({ ...x, datum_bis: e.target.value }))} style={{ ...C.inp, marginBottom: 0, fontSize: 12, flex: 1 }} />
                        </div>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button onClick={saveEdit} style={{ flex: 1, padding: "6px", borderRadius: 8, border: "none", background: ACCENT, color: "#fff", cursor: "pointer", fontSize: 12 }}>✓ Speichern</button>
                          <button onClick={() => setEditId(null)} style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #eee", background: "#fff", cursor: "pointer", fontSize: 12 }}>Abbrechen</button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderBottom: "1px solid #f5f5f5" }}>
                        <div onClick={() => toggle(a.id)} style={{ width: 18, height: 18, borderRadius: 5, border: "2px solid " + (a.erledigt ? ACCENT : "#ccc"), background: a.erledigt ? ACCENT : "#fff", cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          {a.erledigt && <span style={{ color: "#fff", fontSize: 11, fontWeight: 700 }}>✓</span>}
                        </div>
                        <span style={{ flex: 1, fontSize: 12, color: a.erledigt ? "#bbb" : "#333", textDecoration: a.erledigt ? "line-through" : "none" }}>{a.titel}</span>
                        {a.datum_von && <span style={{ fontSize: 9, color: "#bbb" }}>{fmt(a.datum_von)}{a.datum_bis ? "–" + fmt(a.datum_bis) : ""}</span>}
                        <button onClick={() => { setEditId(a.id); setEditData({ titel: a.titel, bauphase: a.bauphase || "", datum_von: a.datum_von || "", datum_bis: a.datum_bis || "" }); }} style={{ background: "none", border: "none", color: "#ccc", cursor: "pointer", fontSize: 12, padding: "0 2px" }}>✎</button>
                        <button onClick={() => del(a.id)} style={{ background: "none", border: "none", color: "#ccc", cursor: "pointer", fontSize: 14, padding: "0 2px" }}>✕</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {auf.length === 0 && <div style={{ fontSize: 12, color: "#bbb", marginBottom: 8 }}>Noch keine Aufgaben.</div>}

      {showForm ? (
        <div style={{ marginTop: 10, padding: 12, background: "#fff", borderRadius: 10, border: "1px solid #e8eaed" }}>
          <input value={neu} onChange={e => setNeu(e.target.value)} placeholder="Aufgabentitel *" style={{ ...C.inp, marginBottom: 6, fontSize: 12 }} autoFocus />
          <input value={neuPhase} onChange={e => setNeuPhase(e.target.value)} placeholder="Bauphase (z.B. Bauphase 1)" style={{ ...C.inp, marginBottom: 6, fontSize: 12 }} />
          <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
            <div style={{ flex: 1 }}><div style={{ fontSize: 10, color: "#aaa", marginBottom: 3 }}>Von</div><input type="date" value={neuVon} onChange={e => setNeuVon(e.target.value)} style={{ ...C.inp, marginBottom: 0, fontSize: 12 }} /></div>
            <div style={{ flex: 1 }}><div style={{ fontSize: 10, color: "#aaa", marginBottom: 3 }}>Bis</div><input type="date" value={neuBis} onChange={e => setNeuBis(e.target.value)} style={{ ...C.inp, marginBottom: 0, fontSize: 12 }} /></div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={add} disabled={!neu.trim()} style={{ flex: 1, padding: "8px", borderRadius: 8, border: "none", background: neu.trim() ? ACCENT : "#ccc", color: "#fff", cursor: neu.trim() ? "pointer" : "default", fontSize: 12, fontWeight: 600 }}>+ Hinzufügen</button>
            <button onClick={() => { setShowForm(false); setNeu(""); setNeuPhase(""); setNeuVon(""); setNeuBis(""); }} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #eee", background: "#fff", cursor: "pointer", fontSize: 12 }}>Abbrechen</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setShowForm(true)} style={{ marginTop: 8, width: "100%", padding: "8px", borderRadius: 10, border: "1.5px dashed #e8eaed", background: "transparent", cursor: "pointer", fontSize: 12, color: "#888" }}>+ Neue Aufgabe</button>
      )}
    </div>
  );
}

export function BaustellenKarte({ b, data, setData, isExp, onToggleExp, onEdit, onDelete, isBauleitung, kolumnen }: Props) {
  const prog  = getProgress(b);
  const maIds = toNumArr(b.mitarbeiter);
  const fzIds = toNumArr(b.fahrzeuge);
  const aMA   = maIds.map((id: number) => data.mitarbeiter.find((m: any) => m.id === id)).filter(Boolean);
  const aFZ   = fzIds.map((id: number) => data.fahrzeuge.find((f: any) => f.id === id)).filter(Boolean);
  const dl    = b.ende ? Math.ceil((new Date(b.ende).getTime() - Date.now()) / 86400000) : null;

  return (
    <div style={{ background: "#f8fffe", borderRadius: 12, border: "1px solid #e8f5f3", marginBottom: 10, overflow: "hidden" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", alignItems: "center", padding: "14px 16px", gap: 12 }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 14, color: "#222" }}>
            {b.name}
            <span style={{ fontWeight: 400, fontSize: 12, color: "#aaa", marginLeft: 6 }}>– {b.ort}</span>
          </div>
          <div style={{ fontSize: 11, color: "#bbb", marginTop: 2 }}>{b.beschreibung}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 60, height: 6, background: "#e0e0e0", borderRadius: 3 }}>
              <div style={{ height: "100%", width: prog + "%", background: ACCENT, borderRadius: 3, transition: "width 0.3s" }} />
            </div>
            <span style={{ fontSize: 12, fontWeight: 700, color: ACCENT, minWidth: 32 }}>{prog}%</span>
            <span style={pill(b.status, true)}>{b.status}</span>
            {dl !== null && !isNaN(dl) && <span style={{ fontSize: 11, color: dl <= 14 ? "#E24B4A" : "#bbb" }}>{dl}d</span>}
            <span style={{ fontSize: 11, color: "#bbb" }}>{aMA.length}MA {aFZ.length}Fzg</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={onToggleExp} style={{ padding: "6px 12px", borderRadius: 10, border: "1.5px solid " + (isExp ? ACCENT : "#eee"), background: isExp ? "#e8f5f3" : "#fff", cursor: "pointer", fontSize: 12, color: isExp ? ACCENT : "#555" }}>
            {isBauleitung ? "Equipment" : "Zuweisen"}
          </button>
          {!isBauleitung && (
            <>
              <button onClick={onEdit} style={{ padding: "6px 10px", borderRadius: 10, border: "1.5px solid #eee", background: "#fff", cursor: "pointer", fontSize: 12, color: "#555" }}>✎</button>
              <button onClick={onDelete} style={{ padding: "6px 10px", borderRadius: 10, border: "none", background: "#E24B4A18", cursor: "pointer", fontSize: 12, color: "#E24B4A" }}>✕</button>
            </>
          )}
        </div>
      </div>

      {isExp && (
        <div>
          <AufgabenPanel b={b} setData={setData} />
          <div style={{ borderTop: "1px solid #e8f5f3", padding: "14px 16px", background: "#fff", display: "grid", gridTemplateColumns: kolumnen.length === 1 ? "1fr" : "1fr 1fr 1fr", gap: 16 }}>
            {kolumnen.map(col => (
              <div key={col.title}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#555", marginBottom: 8 }}>{col.title}</div>
                {col.aList.map((x: any) => (
                  <div key={x.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 8px", background: "#f8fffe", borderRadius: 8, marginBottom: 4, border: "1px solid #e8f5f3" }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 500 }}>{col.getName(x)}</div>
                      <div style={{ fontSize: 10, color: "#bbb" }}>{col.getSub(x)}</div>
                    </div>
                    <button onClick={() => col.fn(x.id)} style={{ background: "#E24B4A18", border: "none", color: "#E24B4A", borderRadius: 6, padding: "2px 7px", cursor: "pointer", fontSize: 11 }}>–</button>
                  </div>
                ))}
                {col.aList.length === 0 && <div style={{ fontSize: 11, color: "#bbb", marginBottom: 6 }}>Keine</div>}
                <div style={{ maxHeight: 160, overflowY: "auto", display: "flex", flexDirection: "column", gap: 3 }}>
                  {col.avList.map((x: any) => (
                    <div key={x.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 8px", background: "#fff", borderRadius: 8, border: "1px solid #eee" }}>
                      <div style={{ fontSize: 11 }}>{col.getName(x)}</div>
                      <button onClick={() => col.fn(x.id)} style={{ background: col.ac + "22", border: "none", color: col.ac, borderRadius: 6, padding: "2px 7px", cursor: "pointer", fontSize: 11 }}>+</button>
                    </div>
                  ))}
                  {col.avList.length === 0 && <div style={{ fontSize: 10, color: "#ccc", fontStyle: "italic" }}>Nichts verfügbar</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
