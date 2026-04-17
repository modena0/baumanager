import { useState } from "react";
import { C, ACCENT, BS_KAT } from "../lib/constants";
import { getProgress, pill } from "../lib/utils";
import { AufgabenPanel } from "../components/Kalender";

export function BaustellenTab({ data, setData, openAdd, openEdit, deleteItem }: any) {
  const [expId, setExpId] = useState<number|null>(null);

  const assignMA = (bsId: number, maId: number) => setData((d: any) => {
    const nb = d.baustellen.map((b: any) => { if (b.id!==bsId) return b; const t = b.mitarbeiter.includes(maId)?b.mitarbeiter.filter((i: number)=>i!==maId):[...b.mitarbeiter,maId]; return {...b,mitarbeiter:t}; });
    const nm = nb.find((b: any)=>b.id===bsId).name; const was = d.baustellen.find((b: any)=>b.id===bsId).mitarbeiter.includes(maId);
    return {...d, baustellen:nb, mitarbeiter:d.mitarbeiter.map((m: any)=>m.id!==maId?m:{...m,baustelle:was?"-":nm})};
  });
  const assignFZ = (bsId: number, fzId: number) => setData((d: any) => {
    const nb = d.baustellen.map((b: any) => { if (b.id!==bsId) return b; const fz=b.fahrzeuge||[]; const up=fz.includes(fzId)?fz.filter((i: number)=>i!==fzId):[...fz,fzId]; return {...b,fahrzeuge:up}; });
    const nm = nb.find((b: any)=>b.id===bsId).name; const was = (d.baustellen.find((b: any)=>b.id===bsId).fahrzeuge||[]).includes(fzId);
    return {...d, baustellen:nb, fahrzeuge:d.fahrzeuge.map((f: any)=>f.id!==fzId?f:{...f,baustelle:was?"-":nm,status:was?"verfügbar":"im Einsatz"})};
  });
  const assignEQ = (bsId: number, lgId: number) => setData((d: any) => {
    const nb = d.baustellen.map((b: any) => { if (b.id!==bsId) return b; const eq=b.equipment||[]; const up=eq.includes(lgId)?eq.filter((i: number)=>i!==lgId):[...eq,lgId]; return {...b,equipment:up}; });
    return {...d, baustellen:nb};
  });

  const bsGruppen = BS_KAT.map(k => ({ key:k, members:data.baustellen.filter((b: any)=>b.kategorie===k) })).filter(g=>g.members.length>0);

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:16 }}>
        <button style={C.btnP} onClick={() => openAdd("baustellen")}>+ Neue Baustelle</button>
      </div>
      {bsGruppen.map(g => (
        <div key={g.key} style={{ ...C.card, marginBottom:16 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14 }}>
            <span style={{ fontSize:15, fontWeight:700, color:"#222" }}>{g.key}</span>
            <span style={{ fontSize:11, color:"#bbb", background:"#f5f5f5", padding:"2px 8px", borderRadius:20 }}>{g.members.length}</span>
          </div>
          {g.members.map((b: any) => {
            const isExp = expId===b.id; const prog = getProgress(b);
            const aMA = b.mitarbeiter.map((id: number)=>data.mitarbeiter.find((m: any)=>m.id===id)).filter(Boolean);
            const aFZ = (b.fahrzeuge||[]).map((id: number)=>data.fahrzeuge.find((f: any)=>f.id===id)).filter(Boolean);
            const aEQ = (b.equipment||[]).map((id: number)=>data.lager.find((l: any)=>l.id===id)).filter(Boolean);
            const avMA = data.mitarbeiter.filter((m: any)=>!b.mitarbeiter.includes(m.id));
            const avFZ = data.fahrzeuge.filter((f: any)=>!(b.fahrzeuge||[]).includes(f.id));
            const avEQ = data.lager.filter((l: any)=>!(b.equipment||[]).includes(l.id));
            const dl = Math.ceil((new Date(b.ende).getTime()-Date.now())/86400000);
            return (
              <div key={b.id} style={{ background:"#f8fffe", borderRadius:12, border:"1px solid #e8f5f3", marginBottom:10, overflow:"hidden" }}>
                <div style={{ display:"grid", gridTemplateColumns:"1fr auto", alignItems:"center", padding:"14px 16px", gap:12 }}>
                  <div>
                    <div style={{ fontWeight:600, fontSize:14, color:"#222" }}>{b.name} <span style={{ fontWeight:400, fontSize:12, color:"#aaa" }}>- {b.ort}</span></div>
                    <div style={{ fontSize:11, color:"#bbb", marginTop:2 }}>{b.beschreibung}</div>
                    <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:8 }}>
                      <div style={{ flex:1, height:6, background:"#e0e0e0", borderRadius:3 }}><div style={{ height:"100%", width:prog+"%", background:ACCENT, borderRadius:3, transition:"width 0.3s" }} /></div>
                      <span style={{ fontSize:12, fontWeight:700, color:ACCENT, minWidth:32 }}>{prog}%</span>
                      <span style={pill(b.status,true)}>{b.status}</span>
                      <span style={{ fontSize:11, color:dl<=14?"#E24B4A":"#bbb" }}>{dl}d</span>
                      <span style={{ fontSize:11, color:"#bbb" }}>{aMA.length}MA {aFZ.length}Fzg</span>
                    </div>
                  </div>
                  <div style={{ display:"flex", gap:6 }}>
                    <button style={{ padding:"6px 12px", borderRadius:10, border:"1.5px solid "+(isExp?ACCENT:"#eee"), background:isExp?"#e8f5f3":"#fff", cursor:"pointer", fontSize:12, color:isExp?ACCENT:"#555" }} onClick={() => setExpId(isExp?null:b.id)}>Zuweisen</button>
                    <button style={{ padding:"6px 10px", borderRadius:10, border:"1.5px solid #eee", background:"#fff", cursor:"pointer", fontSize:12, color:"#555" }} onClick={() => openEdit("baustellen",b)}>✎</button>
                    <button style={{ padding:"6px 10px", borderRadius:10, border:"none", background:"#E24B4A18", cursor:"pointer", fontSize:12, color:"#E24B4A" }} onClick={() => deleteItem("baustellen",b.id)}>✕</button>
                  </div>
                </div>
                {isExp && (
                  <div>
                    <AufgabenPanel baustelle={b} setData={setData} />
                    <div style={{ borderTop:"1px solid #e8f5f3", padding:"14px 16px", background:"#fff", display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:16 }}>
                      {[
                        {title:"Mitarbeiter",aList:aMA,avList:avMA,fn:(id: number)=>assignMA(b.id,id),getName:(x: any)=>x.name,getSub:(x: any)=>x.rolle,ac:"#1D9E75"},
                        {title:"Fahrzeuge",  aList:aFZ,avList:avFZ,fn:(id: number)=>assignFZ(b.id,id),getName:(x: any)=>x.name,getSub:(x: any)=>x.kennzeichen,ac:"#378ADD"},
                        {title:"Equipment",  aList:aEQ,avList:avEQ,fn:(id: number)=>assignEQ(b.id,id),getName:(x: any)=>x.name,getSub:(x: any)=>x.kategorie,ac:"#BA7517"},
                      ].map(col => (
                        <div key={col.title}>
                          <div style={{ fontSize:12, fontWeight:600, color:"#555", marginBottom:8 }}>{col.title}</div>
                          {col.aList.map((x: any) => (
                            <div key={x.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"5px 8px", background:"#f8fffe", borderRadius:8, marginBottom:4, border:"1px solid #e8f5f3" }}>
                              <div><div style={{ fontSize:12, fontWeight:500 }}>{col.getName(x)}</div><div style={{ fontSize:10, color:"#bbb" }}>{col.getSub(x)}</div></div>
                              <button onClick={() => col.fn(x.id)} style={{ background:"#E24B4A18", border:"none", color:"#E24B4A", borderRadius:6, padding:"2px 7px", cursor:"pointer", fontSize:11 }}>-</button>
                            </div>
                          ))}
                          {col.aList.length===0 && <div style={{ fontSize:11, color:"#bbb", marginBottom:6 }}>Keine</div>}
                          <div style={{ maxHeight:120, overflowY:"auto", display:"flex", flexDirection:"column", gap:3 }}>
                            {col.avList.map((x: any) => (
                              <div key={x.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"4px 8px", background:"#fff", borderRadius:8, border:"1px solid #eee" }}>
                                <div style={{ fontSize:11 }}>{col.getName(x)}</div>
                                <button onClick={() => col.fn(x.id)} style={{ background:col.ac+"22", border:"none", color:col.ac, borderRadius:6, padding:"2px 7px", cursor:"pointer", fontSize:11 }}>+</button>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}