import { C, ACCENT, MA_KAT } from "../lib/constants";
import { pill, autoKat } from "../lib/utils";

function toArr(val: any): string[] {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  return val.split(",").map((s: string) => s.trim()).filter(Boolean);
}

export function MitarbeiterTab({ data, onAdd, onEdit, onDelete, onDetail }: any) {
  const gruppen = MA_KAT.map(k => ({ key:k, members:data.mitarbeiter.filter((m: any) => autoKat(m)===k) }));
  return (
    <div>
      <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:16 }}>
        <button style={C.btnP} onClick={() => onAdd("mitarbeiter")}>+ Mitarbeiter</button>
      </div>
      {gruppen.filter(g => g.members.length>0).map(g => (
        <div key={g.key} style={{ ...C.card, marginBottom:16 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
            <span style={{ fontSize:15, fontWeight:700, color:"#222" }}>{g.key}</span>
            <span style={{ fontSize:12, color:"#bbb" }}>{g.members.length} Mitarbeiter</span>
          </div>
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", tableLayout:"fixed" }}>
              <colgroup><col style={{width:"18%"}}/><col style={{width:"12%"}}/><col style={{width:"22%"}}/><col style={{width:"13%"}}/><col style={{width:"13%"}}/><col style={{width:"10%"}}/><col style={{width:"12%"}}/></colgroup>
              <thead><tr><th style={C.th}>Name</th><th style={C.th}>Rolle</th><th style={C.th}>Qualifikationen</th><th style={C.th}>Führerschein</th><th style={C.th}>Baustelle</th><th style={C.th}>Status</th><th style={C.th}></th></tr></thead>
              <tbody>
                {g.members.map((m: any) => (
                  <tr key={m.id}>
                    <td style={C.td}><div style={{ fontWeight:600, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{m.name}</div><div style={{ fontSize:11, color:"#bbb" }}>{m.telefon}</div></td>
                    <td style={C.td}><div style={{ whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{m.rolle}</div></td>
                    <td style={C.td}><div style={{ display:"flex", flexWrap:"wrap", gap:3 }}>{toArr(m.qualifikationen).map((q: string)=><span key={q} style={C.tag}>{q}</span>)}</div></td>
                    <td style={C.td}><div style={{ display:"flex", flexWrap:"wrap", gap:3 }}>{toArr(m.fuehrerschein).map((f: string)=><span key={f} style={{ display:"inline-block", padding:"2px 7px", borderRadius:8, fontSize:10, background:"#e8f5f3", color:ACCENT, marginRight:4 }}>{f}</span>)}</div></td>
                    <td style={C.td}><div style={{ whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{m.baustelle}</div></td>
                    <td style={C.td}><span style={pill(m.status)}>{m.status}</span></td>
                    <td style={C.td}>
                      <div style={{ display:"flex", flexDirection:"column", gap:3 }}>
                        <button style={{ padding:"3px 8px", borderRadius:6, border:"1px solid #eee", background:"#fff", cursor:"pointer", fontSize:11, color:"#555" }} onClick={() => onDetail(m)}>Details</button>
                        <button style={{ padding:"3px 8px", borderRadius:6, border:"1px solid #eee", background:"#fff", cursor:"pointer", fontSize:11, color:"#555" }} onClick={() => onEdit("mitarbeiter",m)}>Bearb.</button>
                        <button style={{ padding:"3px 8px", borderRadius:6, border:"none", background:"#E24B4A18", cursor:"pointer", fontSize:11, color:"#E24B4A" }} onClick={() => onDelete("mitarbeiter",m.id)}>Löschen</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}