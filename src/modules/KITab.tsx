import { useState } from "react";
import { C, ACCENT } from "../lib/constants";

const prompts = [
  ["Stillstandzeiten", "Analysiere Fahrzeuge und reduziere Stillstandzeiten."],
  ["Teamkonflikte",    "Pruefe Baustellen auf Teamkonflikte."],
  ["Wochenplanung",    "Erstelle Wochenplan fuer alle Baustellen."],
  ["Risiken",          "Identifiziere Engpaesse und Fahrzeugausfaelle."],
];

export function KITab({ data, callAI }: any) {
  const [res,   setRes]   = useState("");
  const [load,  setLoad]  = useState(false);
  const [frage, setFrage] = useState("");

  return (
    <div style={C.card}>
      <div style={{ fontSize:16, fontWeight:700, color:"#222", marginBottom:16 }}>KI-Optimierung</div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:10, marginBottom:16 }}>
        {prompts.map(p => (
          <button key={p[0]} style={{ padding:"10px 14px", borderRadius:10, border:"1.5px solid #e8f5f3", background:"#f8fffe", cursor:"pointer", fontSize:13, color:ACCENT, fontWeight:500, textAlign:"left" }} onClick={() => callAI(p[1],setRes,setLoad)}>{p[0]}</button>
        ))}
      </div>
      <div style={{ display:"flex", gap:8, marginBottom:8 }}>
        <input style={{ ...C.inp, marginBottom:0, flex:1 }} value={frage} onChange={e => setFrage(e.target.value)} placeholder="Eigene Frage..." />
        <button style={C.btnP} onClick={() => { if (frage) callAI(frage,setRes,setLoad); }}>Senden</button>
      </div>
      <div style={{ background:"#f8fffe", borderRadius:10, padding:14, minHeight:80, fontSize:13, lineHeight:1.75, color:"#444", whiteSpace:"pre-wrap", border:"1px solid #e8f5f3" }}>
        {load ? "KI analysiert..." : res || "Wähle eine Analyse oder stelle eine Frage."}
      </div>
    </div>
  );
}