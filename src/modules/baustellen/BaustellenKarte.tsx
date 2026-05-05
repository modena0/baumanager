import { ACCENT, C } from "../../lib/constants";
import { getProgress, pill } from "../../lib/utils";
import { AufgabenPanel } from "../../components/Kalender";

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

const toNumArr = (arr: any[]): number[] => arr.map((i: any) => Number(i)).filter((i: number) => !isNaN(i));

export function BaustellenKarte({ b, data, setData, isExp, onToggleExp, onEdit, onDelete, isBauleitung, kolumnen }: Props) {
  const prog  = getProgress(b);
  const maIds = toNumArr(b.mitarbeiter || []);
  const fzIds = toNumArr(b.fahrzeuge   || []);
  const aMA   = maIds.map((id: number) => data.mitarbeiter.find((m: any) => m.id === id)).filter(Boolean);
  const aFZ   = fzIds.map((id: number) => data.fahrzeuge.find((f: any) => f.id === id)).filter(Boolean);
  const dl    = b.ende ? Math.ceil((new Date(b.ende).getTime() - Date.now()) / 86400000) : null;

  return (
    <div style={{ background: "#f8fffe", borderRadius: 12, border: "1px solid #e8f5f3", marginBottom: 10, overflow: "hidden" }}>

      {/* Kopf */}
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
          <button onClick={onToggleExp}
            style={{ padding: "6px 12px", borderRadius: 10, border: "1.5px solid " + (isExp ? ACCENT : "#eee"), background: isExp ? "#e8f5f3" : "#fff", cursor: "pointer", fontSize: 12, color: isExp ? ACCENT : "#555" }}>
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

      {/* Aufgaben + Zuweisung */}
      {isExp && (
        <div>
          <AufgabenPanel baustelle={b} setData={setData} />
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
