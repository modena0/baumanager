import { useState } from "react";
import { C, ACCENT } from "../lib/constants";
import { getProgress } from "../lib/utils";
import { Kalender } from "../components/Kalender";

export function Dashboard({ data, setTab, saveTermin, deleteTermin }: any) {
  const [aiRes,  setAiRes]  = useState("");
  const [aiLoad, setAiLoad] = useState(false);
  const [frage,  setFrage]  = useState("");

  const bsColors = ["#b2dfdb","#80cbc4","#4DB6AC","#26a69a","#00897b"];

  const ask = (p: string) => {
    setAiLoad(true); setAiRes("");
    const ctx = "Kurze Antwort auf Deutsch. Daten:" + JSON.stringify({
      baustellen: data.baustellen.map((b: any) => ({ name:b.name, status:b.status, fortschritt:getProgress(b) })),
      fahrzeuge:  data.fahrzeuge,
      mitarbeiter:data.mitarbeiter.map((m: any) => ({ name:m.name, status:m.status, baustelle:m.baustelle })),
    });
    fetch("https://api.anthropic.com/v1/messages", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ model:"claude-sonnet-4-20250514", max_tokens:400, system:ctx, messages:[{role:"user",content:p}] }) })
      .then(r=>r.json()).then(d=>setAiRes((d.content&&d.content[0]&&d.content[0].text)||"Keine Antwort.")).catch(e=>setAiRes("Fehler: "+e.message)).finally(()=>setAiLoad(false));
  };

  const sorted = data.baustellen.filter((b: any)=>b.status!=="abgeschlossen").sort((a: any,b: any)=>Math.ceil((new Date(a.ende).getTime()-Date.now())/86400000)-Math.ceil((new Date(b.ende).getTime()-Date.now())/86400000)).slice(0,5);

  return (
    <div style={{ display:"grid", gridTemplateColumns:"1fr 360px", gap:20, alignItems:"start" }}>
      <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
        <div style={C.card}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
            <span style={{ fontSize:16, fontWeight:700, color:"#222" }}>Aktive Baustellen</span>
            <button onClick={() => setTab(3)} style={{ fontSize:12, color:ACCENT, background:"none", border:"none", cursor:"pointer", fontWeight:500 }}>Alle anzeigen</button>
          </div>
          {sorted.map((b: any, idx: number) => {
            const col = bsColors[idx%bsColors.length], prog = getProgress(b), auf = b.aufgaben||[], done = auf.filter((a: any)=>a.erledigt).length, dl = Math.ceil((new Date(b.ende).getTime()-Date.now())/86400000);
            return (
              <div key={b.id} style={{ background:col+"44", borderRadius:12, padding:"12px 16px", marginBottom:10, border:"1.5px solid "+col }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:6 }}>
                  <div><div style={{ fontWeight:600, fontSize:13, color:"#333" }}>{b.name}</div><div style={{ fontSize:11, color:"#888", marginTop:1 }}>{b.ort} - {b.kategorie}</div></div>
                  <div style={{ textAlign:"right", flexShrink:0, marginLeft:12 }}><div style={{ fontSize:20, fontWeight:700, color:ACCENT }}>{prog}%</div><div style={{ fontSize:10, color:dl<=14?"#E24B4A":"#aaa" }}>{dl}d</div></div>
                </div>
                <div style={{ height:4, background:"rgba(0,0,0,0.08)", borderRadius:2, marginBottom:6 }}><div style={{ height:"100%", width:prog+"%", background:ACCENT, borderRadius:2 }} /></div>
                {auf.length>0 && <div style={{ display:"flex", flexWrap:"wrap", gap:4 }}>{auf.slice(0,4).map((a: any)=><span key={a.id} style={{ fontSize:10, padding:"1px 7px", borderRadius:10, background:a.erledigt?ACCENT+"22":"#f0f0f0", color:a.erledigt?ACCENT:"#999", textDecoration:a.erledigt?"line-through":"none" }}>{a.titel}</span>)}{auf.length>4&&<span style={{ fontSize:10, color:"#bbb" }}>+{auf.length-4}</span>}<span style={{ fontSize:10, color:"#bbb", marginLeft:"auto" }}>{done}/{auf.length} erledigt</span></div>}
                {auf.length===0 && <div style={{ fontSize:11, color:"#bbb", fontStyle:"italic" }}>Keine Aufgaben</div>}
              </div>
            );
          })}
        </div>
        <div style={C.card}>
          <div style={{ fontSize:16, fontWeight:700, color:"#222", marginBottom:14 }}>Baustellen-Übersicht</div>
          <div style={{ borderRadius:12, overflow:"hidden", border:"1px solid #eee" }}>
            <svg viewBox="0 0 540 200" width="100%" style={{ display:"block", background:"#e8f5f3" }}>
              <path d="M0,140 Q140,120 270,150 Q390,180 540,160" fill="none" stroke="#b2dfdb" strokeWidth={12}/>
              <path d="M270,0 Q278,80 270,150 Q262,190 278,200" fill="none" stroke="#b2dfdb" strokeWidth={8}/>
              <text x={230} y={195} fontSize={10} fill={ACCENT} textAnchor="middle" fontWeight={600}>Dresden</text>
              <text x={65}  y={185} fontSize={10} fill={ACCENT} textAnchor="middle" fontWeight={600}>Leipzig</text>
              {data.baustellen.map((b: any, idx: number) => {
                const pins=[{x:310,y:85},{x:235,y:132},{x:75,y:160}], p=pins[idx]||{x:160+idx*60,y:120}, prog=getProgress(b);
                return (
                  <g key={b.id}>
                    {b.status==="laufend"&&<circle cx={p.x} cy={p.y} r={18} fill={ACCENT} opacity={0.12}/>}
                    <circle cx={p.x} cy={p.y} r={10} fill="#fff" stroke={ACCENT} strokeWidth={2}/>
                    <circle cx={p.x} cy={p.y} r={6}  fill={ACCENT}/>
                    <rect x={p.x-28} y={p.y+13} width={56} height={20} rx={5} fill="#fff" stroke={ACCENT} strokeWidth={1}/>
                    <text x={p.x} y={p.y+22} textAnchor="middle" fontSize={7} fill={ACCENT} fontWeight={700}>{b.name}</text>
                    <text x={p.x} y={p.y+30} textAnchor="middle" fontSize={7} fill="#888">{prog}%</text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
        <div style={C.card}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
            <span style={{ fontSize:16, fontWeight:700, color:"#222" }}>Kalender</span>
            <button onClick={() => setTab(4)} style={{ fontSize:12, color:ACCENT, background:"none", border:"none", cursor:"pointer", fontWeight:500 }}>Vollansicht</button>
          </div>
          <Kalender termine={data.termine||[]} onSave={saveTermin} onDelete={deleteTermin} compact={true} baustellen={data.baustellen}/>
        </div>
        <div style={C.card}>
          <div style={{ fontSize:16, fontWeight:700, color:"#222", marginBottom:14 }}>KI Hilfe</div>
          <div style={{ display:"flex", gap:6, marginBottom:10, flexWrap:"wrap" }}>
            {[["Auslastung","Kurze Zusammenfassung der aktuellen Auslastung."],["Engpässe","Kritische Engpaesse?"],["Heute","Was sollte ich heute zuerst tun?"]].map(q =>
              <button key={q[0]} onClick={() => ask(q[1])} style={{ padding:"5px 12px", borderRadius:20, background:"#f0faf9", border:"1px solid "+ACCENT+"44", color:ACCENT, cursor:"pointer", fontSize:11, fontWeight:500 }}>{q[0]}</button>
            )}
          </div>
          <div style={{ display:"flex", gap:6, marginBottom:8 }}>
            <input style={{ ...C.inp, marginBottom:0, flex:1, fontSize:12 }} value={frage} onChange={e=>setFrage(e.target.value)} placeholder="Frage stellen..."/>
            <button onClick={() => { if (frage) ask(frage); }} style={{ padding:"8px 14px", borderRadius:10, border:"none", background:ACCENT, cursor:"pointer", fontSize:12, color:"#fff", fontWeight:600, flexShrink:0 }}>→</button>
          </div>
          <div style={{ background:"#f8fffe", borderRadius:10, padding:12, minHeight:60, fontSize:12, lineHeight:1.7, color:aiLoad?"#bbb":"#444", whiteSpace:"pre-wrap", border:"1px solid #e8f5f3" }}>{aiLoad?"KI analysiert...":aiRes||"Stelle eine Frage."}</div>
        </div>
      </div>
    </div>
  );
}
