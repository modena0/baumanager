import { C } from "../lib/constants";
import { Kalender } from "../components/Kalender";

export function KalenderTab({ data, saveTermin, deleteTermin }: any) {
  return (
    <div style={C.card}>
      <div style={{ fontSize:16, fontWeight:700, color:"#222", marginBottom:16 }}>Kalender und Termine</div>
      <Kalender termine={data.termine||[]} onSave={saveTermin} onDelete={deleteTermin} compact={false} baustellen={data.baustellen}/>
    </div>
  );
}
