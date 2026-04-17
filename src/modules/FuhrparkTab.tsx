import { C } from "../lib/constants";
import { pill } from "../lib/utils";

const icons: Record<string, string> = { LKW:"🚛", Bagger:"🚧", Transporter:"🚐", Kran:"🏗", PKW:"🚗" };

export function FuhrparkTab({ data, openAdd, openEdit, deleteItem, simulateGPS, gpsStatus }: any) {
  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <div style={{ width:8, height:8, borderRadius:"50%", background:"#4DB6AC" }} />
          <span style={{ fontSize:12, color:"#aaa" }}>{gpsStatus}</span>
          <button style={{ padding:"5px 12px", borderRadius:8, border:"1.5px solid #e8eaed", background:"#fff", cursor:"pointer", fontSize:12, color:"#555" }} onClick={simulateGPS}>GPS</button>
        </div>
        <button style={C.btnP} onClick={() => openAdd("fahrzeuge")}>+ Fahrzeug</button>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))", gap:14 }}>
        {data.fahrzeuge.map((f: any) => (
          <div key={f.id} style={C.card}>
            <div style={{ fontSize:28, marginBottom:8 }}>{icons[f.typ]||"🚗"}</div>
            <div style={{ fontWeight:600, fontSize:13, marginBottom:2 }}>{f.name}</div>
            <div style={{ fontSize:11, color:"#bbb", marginBottom:8 }}>{f.kennzeichen}</div>
            <span style={pill(f.status,true)}>{f.status}</span>
            {f.baustelle!=="-" && <div style={{ fontSize:11, color:"#bbb", marginTop:6 }}>Baustelle: {f.baustelle}</div>}
            {f.fahrer!=="-"    && <div style={{ fontSize:11, color:"#bbb" }}>Fahrer: {f.fahrer}</div>}
            {f.freiAb          && <div style={{ fontSize:11, color:"#BA7517", marginTop:4 }}>Frei ab: {f.freiAb}</div>}
            <div style={{ display:"flex", gap:6, marginTop:10 }}>
              <button style={{ padding:"4px 10px", borderRadius:8, border:"1.5px solid #eee", background:"#fff", cursor:"pointer", fontSize:11, color:"#555", flex:1 }} onClick={() => openEdit("fahrzeuge",f)}>Bearbeiten</button>
              <button style={{ padding:"4px 10px", borderRadius:8, border:"none", background:"#E24B4A18", cursor:"pointer", fontSize:11, color:"#E24B4A" }} onClick={() => deleteItem("fahrzeuge",f.id)}>✕</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}