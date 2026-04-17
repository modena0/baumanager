import { C, ACCENT } from "../lib/constants";

export function LagerTab({ data, openAdd, openEdit, deleteItem }: any) {
  return (
    <div>
      <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:16 }}>
        <button style={C.btnP} onClick={() => openAdd("lager")}>+ Artikel</button>
      </div>
      <div style={C.card}>
        <table style={{ width:"100%", borderCollapse:"collapse" }}>
          <thead>
            <tr>
              <th style={C.th}>Artikel</th><th style={C.th}>Kategorie</th><th style={C.th}>Gesamt</th>
              <th style={C.th}>Verfügbar</th><th style={C.th}>Mindestbestand</th><th style={C.th}>Zugewiesen</th><th style={C.th}></th>
            </tr>
          </thead>
          <tbody>
            {data.lager.map((l: any) => {
              const krit = l.verfuegbar <= l.mindestbestand;
              return (
                <tr key={l.id}>
                  <td style={C.td}><div style={{ fontWeight:500 }}>{l.name}</div></td>
                  <td style={C.td}>{l.kategorie}</td>
                  <td style={C.td}>{l.anzahl}</td>
                  <td style={C.td}><span style={{ color:krit?"#E24B4A":ACCENT, fontWeight:600 }}>{l.verfuegbar}</span></td>
                  <td style={C.td}>{l.mindestbestand}</td>
                  <td style={C.td}>{l.zugewiesen}</td>
                  <td style={C.td}>
                    <div style={{ display:"flex", gap:6 }}>
                      <button style={{ padding:"4px 10px", borderRadius:8, border:"1.5px solid #eee", background:"#fff", cursor:"pointer", fontSize:11, color:"#555" }} onClick={() => openEdit("lager",l)}>✎</button>
                      <button style={{ padding:"4px 10px", borderRadius:8, border:"none", background:"#E24B4A18", cursor:"pointer", fontSize:11, color:"#E24B4A" }} onClick={() => deleteItem("lager",l.id)}>✕</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}