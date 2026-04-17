import { useState } from "react";
import { C, ACCENT, T_ARTEN, T_COL, MN, DN } from "../lib/constants";

export function TerminForm({ onSave, onCancel, prefill = {} as any, baustellen = [] as any[] }) {
  const [f, setF] = useState({
    titel: prefill.titel || "", datum: prefill.datum || "", uhrzeit: prefill.uhrzeit || "",
    art: prefill.art || "Besprechung", baustelle: prefill.baustelle || "Alle",
    beschreibung: prefill.beschreibung || "", erinnerung: !!prefill.erinnerung,
  });
  const upd = (field: string) => (e: any) => setF(p => ({ ...p, [field]: e.target.value }));

  return (
    <div>
      <div style={{ fontWeight:700, fontSize:15, color:"#222", marginBottom:16 }}>{prefill.id ? "Termin bearbeiten" : "Neuer Termin"}</div>
      <label style={C.lbl}>Titel</label>
      <input style={C.inp} value={f.titel} onChange={upd("titel")} placeholder="z.B. Behoerdenabnahme" autoFocus />
      <label style={C.lbl}>Art</label>
      <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:8 }}>
        {T_ARTEN.map(a => {
          const active = f.art === a; const col = T_COL[a] || "#888";
          return (
            <button key={a} onClick={() => setF(p => ({ ...p, art: a }))} style={{ padding:"6px 14px", borderRadius:20, border:"1.5px solid "+(active?col:"#e8eaed"), background:active?col+"18":"#fff", color:active?col:"#888", cursor:"pointer", fontSize:12, fontWeight:active?600:400 }}>{a}</button>
          );
        })}
      </div>
      <div style={C.r2}>
        <div><label style={C.lbl}>Datum</label><input style={C.inp} type="date" value={f.datum} onChange={upd("datum")} /></div>
        <div><label style={C.lbl}>Uhrzeit</label><input style={C.inp} type="time" value={f.uhrzeit} onChange={upd("uhrzeit")} /></div>
      </div>
      <label style={C.lbl}>Baustelle</label>
      <select style={C.inp} value={f.baustelle} onChange={upd("baustelle")}>
        <option value="Alle">Alle</option>
        {baustellen.map((b: any) => <option key={b.id} value={b.name}>{b.name}</option>)}
      </select>
      <label style={C.lbl}>Beschreibung</label>
      <input style={C.inp} value={f.beschreibung} onChange={upd("beschreibung")} placeholder="optional" />
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:16 }}>
        <input type="checkbox" id="erin" checked={f.erinnerung} onChange={e => setF(p => ({ ...p, erinnerung: e.target.checked }))} style={{ width:16, height:16, accentColor:ACCENT }} />
        <label htmlFor="erin" style={{ fontSize:12, color:"#888", cursor:"pointer" }}>Erinnerung aktivieren</label>
      </div>
      <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
        <button style={C.btnS} onClick={onCancel}>Abbrechen</button>
        <button style={{ ...C.btnP, background:(!f.titel||!f.datum)?"#ccc":ACCENT }} onClick={() => { if (f.titel && f.datum) onSave(f); }}>Speichern</button>
      </div>
    </div>
  );
}

export function AufgabenPanel({ baustelle: b, setData }: any) {
  const [neu, setNeu] = useState("");
  const auf = b.aufgaben || [];
  const done = auf.filter((a: any) => a.erledigt).length;
  const prog = auf.length > 0 ? Math.round(done / auf.length * 100) : 0;

  function updBS(fn: (x: any) => any) { setData((d: any) => ({ ...d, baustellen: d.baustellen.map((x: any) => x.id === b.id ? fn(x) : x) })); }
  function toggle(id: number) { updBS(x => ({ ...x, aufgaben: x.aufgaben.map((a: any) => a.id === id ? { ...a, erledigt: !a.erledigt } : a) })); }
  function del(id: number) { updBS(x => ({ ...x, aufgaben: x.aufgaben.filter((a: any) => a.id !== id) })); }
  function add() {
    if (!neu.trim()) return;
    updBS(x => { const l = x.aufgaben || []; const nid = Math.max(0, ...l.map((a: any) => a.id)) + 1; return { ...x, aufgaben: [...l, { id: nid, titel: neu.trim(), erledigt: false }] }; });
    setNeu("");
  }

  return (
    <div style={{ borderTop:"1px solid #e8f5f3", padding:"14px 16px", background:"#f8fffe" }}>
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
        <span style={{ fontSize:12, fontWeight:600, color:"#555" }}>Aufgaben</span>
        <div style={{ flex:1, height:6, background:"#e0e0e0", borderRadius:3 }}>
          <div style={{ height:"100%", width:prog+"%", background:ACCENT, borderRadius:3, transition:"width 0.3s" }} />
        </div>
        <span style={{ fontSize:13, fontWeight:700, color:ACCENT, minWidth:36, textAlign:"right" }}>{prog}%</span>
        <span style={{ fontSize:11, color:"#bbb" }}>{done}/{auf.length}</span>
      </div>
      {auf.map((a: any) => (
        <div key={a.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"6px 0", borderBottom:"1px solid #f0f0f0" }}>
          <div onClick={() => toggle(a.id)} style={{ width:18, height:18, borderRadius:5, border:"2px solid "+(a.erledigt?ACCENT:"#ccc"), background:a.erledigt?ACCENT:"#fff", cursor:"pointer", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center" }}>
            {a.erledigt && <span style={{ color:"#fff", fontSize:11, fontWeight:700 }}>✓</span>}
          </div>
          <span style={{ flex:1, fontSize:13, color:a.erledigt?"#bbb":"#333", textDecoration:a.erledigt?"line-through":"none" }}>{a.titel}</span>
          <button onClick={() => del(a.id)} style={{ background:"none", border:"none", color:"#ccc", cursor:"pointer", fontSize:14 }}>✕</button>
        </div>
      ))}
      {auf.length === 0 && <div style={{ fontSize:12, color:"#bbb", marginBottom:8 }}>Noch keine Aufgaben.</div>}
      <div style={{ display:"flex", gap:8, marginTop:10 }}>
        <input value={neu} onChange={e => setNeu(e.target.value)} onKeyDown={e => { if (e.key === "Enter") add(); }}
          placeholder="Neue Aufgabe..." style={{ flex:1, padding:"7px 10px", borderRadius:10, border:"1.5px solid #e8eaed", fontSize:12, outline:"none" }} />
        <button onClick={add} style={{ padding:"7px 14px", borderRadius:10, border:"none", background:ACCENT, cursor:"pointer", fontSize:12, color:"#fff", fontWeight:600 }}>+</button>
      </div>
    </div>
  );
}

export function Kalender({ termine, onSave, onDelete, compact, baustellen = [] as any[] }: any) {
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];
  const [year,  setYear]  = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [sel,   setSel]   = useState<number|null>(null);
  const [formData, setFormData] = useState<any>(null);

  const prevM = () => { if (month===0) { setMonth(11); setYear(y=>y-1); } else setMonth(m=>m-1); };
  const nextM = () => { if (month===11) { setMonth(0); setYear(y=>y+1); } else setMonth(m=>m+1); };
  const ds = (d: number) => year+"-"+String(month+1).padStart(2,"0")+"-"+String(d).padStart(2,"0");
  const getTF = (d: number) => termine.filter((t: any) => t.datum === ds(d));
  const isT = (d: number) => d && year===today.getFullYear() && month===today.getMonth() && d===today.getDate();

  const fd = new Date(year, month, 1).getDay();
  const dim = new Date(year, month+1, 0).getDate();
  const off = (fd+6)%7;
  const cells: number[] = [];
  for (let i=0;i<off;i++) cells.push(0);
  for (let d=1;d<=dim;d++) cells.push(d);

  const pflicht = termine.filter((t: any)=>t.art==="Pflichttermin"&&t.datum>=todayStr).sort((a: any,b: any)=>a.datum.localeCompare(b.datum)).slice(0,4);
  const selTs = sel ? getTF(sel) : [];
  const sz = compact ? 32 : 44;

  if (formData !== null) {
    return <TerminForm onSave={(d: any) => { onSave({...formData,...d}); setFormData(null); }} onCancel={() => setFormData(null)} prefill={formData} baustellen={baustellen} />;
  }

  const rows: JSX.Element[] = [];
  for (let ri=0; ri<Math.ceil(cells.length/7); ri++) {
    const row = cells.slice(ri*7, ri*7+7);
    rows.push(
      <tr key={ri}>
        {row.map((d,ci) => {
          if (!d) return <td key={ci}></td>;
          const ts = getTF(d); const hasPfl = ts.some((t: any)=>t.art==="Pflichttermin");
          const isTod = isT(d); const isSel = sel===d;
          return (
            <td key={ci} style={{ padding:2, textAlign:"center" }}>
              <div onClick={() => setSel(isSel?null:d)} style={{ width:sz, height:sz, borderRadius:"50%", margin:"0 auto", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", background:isTod?ACCENT:isSel?"#e8f5f3":"transparent", border:isSel&&!isTod?"1.5px solid "+ACCENT:"none", position:"relative", flexDirection:"column" }}>
                <span style={{ fontSize:compact?11:13, fontWeight:isTod?700:400, color:isTod?"#fff":isSel?ACCENT:"#333" }}>{d}</span>
                {(hasPfl||ts.length>0) && <div style={{ position:"absolute", bottom:compact?3:5, left:"50%", transform:"translateX(-50%)", width:4, height:4, borderRadius:"50%", background:isTod?"#fff":hasPfl?"#E24B4A":ACCENT }} />}
              </div>
            </td>
          );
        })}
        {row.length<7 && Array(7-row.length).fill(0).map((_,ei) => <td key={"e"+ei}></td>)}
      </tr>
    );
  }

  return (
    <div>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <button onClick={prevM} style={{ background:"#f5f5f5", border:"none", borderRadius:8, width:28, height:28, cursor:"pointer", fontSize:14, color:"#555" }}>‹</button>
          <span style={{ fontWeight:700, fontSize:compact?16:22, color:"#222" }}>{MN[month].slice(0,3).toUpperCase()} {year}</span>
          <button onClick={nextM} style={{ background:"#f5f5f5", border:"none", borderRadius:8, width:28, height:28, cursor:"pointer", fontSize:14, color:"#555" }}>›</button>
        </div>
        {!compact && <button onClick={() => setFormData({})} style={C.btnP}>+ Termin</button>}
      </div>
      <table style={{ width:"100%", borderCollapse:"collapse" }}>
        <thead><tr>{DN.map(dn => <th key={dn} style={{ textAlign:"center", fontSize:10, color:"#bbb", fontWeight:600, padding:"2px 0" }}>{dn}</th>)}</tr></thead>
        <tbody>{rows}</tbody>
      </table>
      {!compact && (
        <div style={{ marginTop:16 }}>
          {sel && (
            <div style={{ background:"#f8fffe", borderRadius:10, padding:12, marginBottom:12, border:"1px solid #e8f5f3" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                <span style={{ fontSize:12, fontWeight:600, color:ACCENT }}>{sel}. {MN[month]} {year}</span>
                <button onClick={() => setFormData({datum:ds(sel)})} style={{ fontSize:11, color:ACCENT, background:"#e8f5f3", border:"none", borderRadius:8, padding:"4px 10px", cursor:"pointer" }}>+ Termin</button>
              </div>
              {selTs.length===0 && <div style={{ fontSize:12, color:"#bbb" }}>Keine Termine.</div>}
              {selTs.map((t: any) => (
                <div key={t.id} style={{ display:"flex", alignItems:"center", gap:8, padding:"6px 0", borderBottom:"1px solid #eee" }}>
                  <div style={{ width:3, height:28, borderRadius:2, background:T_COL[t.art]||"#888", flexShrink:0 }} />
                  <div style={{ flex:1 }}><div style={{ fontSize:12, fontWeight:500 }}>{t.titel}</div><div style={{ fontSize:11, color:"#aaa" }}>{t.uhrzeit} - {t.art} - {t.baustelle}</div></div>
                  <button onClick={() => setFormData(t)} style={{ background:"none", border:"none", color:ACCENT, cursor:"pointer", fontSize:13 }}>✎</button>
                  <button onClick={() => onDelete(t.id)} style={{ background:"none", border:"none", color:"#E24B4A", cursor:"pointer", fontSize:13 }}>✕</button>
                </div>
              ))}
            </div>
          )}
          <div style={{ fontSize:12, fontWeight:600, color:"#888", marginBottom:8 }}>Pflichttermine</div>
          {pflicht.length===0 && <div style={{ fontSize:12, color:"#bbb" }}>Keine anstehend</div>}
          {pflicht.map((t: any) => (
            <div key={t.id} style={{ display:"flex", gap:10, padding:"7px 0", borderBottom:"1px solid #f5f5f5" }}>
              <div style={{ width:3, background:"#E24B4A", borderRadius:2, flexShrink:0 }} />
              <div><div style={{ fontSize:12, fontWeight:500 }}>{t.titel}</div><div style={{ fontSize:11, color:"#bbb" }}>{t.datum} {t.uhrzeit} - {t.baustelle}</div></div>
            </div>
          ))}
        </div>
      )}
      {compact && sel && selTs.length>0 && (
        <div style={{ marginTop:8, background:"#f8fffe", borderRadius:8, padding:8, border:"1px solid #e8f5f3" }}>
          <div style={{ fontSize:11, fontWeight:600, color:ACCENT, marginBottom:4 }}>{sel}. {MN[month]}</div>
          {selTs.map((t: any) => <div key={t.id} style={{ fontSize:11, color:"#555", padding:"2px 0" }}>{t.uhrzeit} {t.titel}</div>)}
        </div>
      )}
    </div>
  );
}