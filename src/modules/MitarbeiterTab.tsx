import { C, ACCENT, MA_KAT } from "../lib/constants";
import { pill, autoKat } from "../lib/utils";

// ── Robuster Array-Parser ──────────────────────────────────────────────────────
function toArr(val: any): string[] {
  if (!val) return [];
  if (Array.isArray(val)) return val.map(String).filter(Boolean);

  // Versuche JSON zu parsen (z.B. "[\"B\",\"C\"]")
  if (typeof val === "string") {
    const trimmed = val.trim();
    if (trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
      } catch {
        // JSON parse fehlgeschlagen, weiter mit String-Split
      }
      // Doppelt escaped JSON versuchen
      try {
        const parsed = JSON.parse(JSON.parse(`"${trimmed.replace(/"/g, '\\"')}"`));
        if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
      } catch {
        // ignorieren
      }
    }
    // Komma-separierter String
    return trimmed.split(",").map((s: string) => s.trim()).filter(Boolean);
  }

  return [];
}

export function MitarbeiterTab({ data, onAdd, onEdit, onDelete, onDetail, kannLohnSehen, isMobile }: any) {
  const gruppen = MA_KAT.map(k => ({ key: k, members: data.mitarbeiter.filter((m: any) => autoKat(m) === k) }));

  // ── MOBILE LAYOUT ─────────────────────────────────────────────────────────────
  if (isMobile) {
    return (
      <div>
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
          <button style={{ ...C.btnP, padding: "10px 20px" }} onClick={() => onAdd("mitarbeiter")}>+ Mitarbeiter</button>
        </div>

        {gruppen.filter(g => g.members.length > 0).map(g => (
          <div key={g.key} style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#888", textTransform: "uppercase" as any, marginBottom: 8, paddingLeft: 4 }}>
              {g.key} ({g.members.length})
            </div>
            {g.members.map((m: any) => (
              <div key={m.id} style={{ ...C.card, marginBottom: 10, padding: "14px 16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15, color: "#222" }}>{m.name}</div>
                    <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>{m.rolle}</div>
                    {m.baustelle && m.baustelle !== "-" && (
                      <div style={{ fontSize: 11, color: ACCENT, marginTop: 2 }}>📍 {m.baustelle}</div>
                    )}
                  </div>
                  <span style={pill(m.status)}>{m.status}</span>
                </div>

                {/* Qualifikationen */}
                {toArr(m.qualifikationen).length > 0 && (
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 10, color: "#bbb", marginBottom: 4 }}>Qualifikationen</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {toArr(m.qualifikationen).map((q: string) => <span key={q} style={C.tag}>{q}</span>)}
                    </div>
                  </div>
                )}

                {/* Führerschein */}
                {toArr(m.fuehrerschein).length > 0 && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 10, color: "#bbb", marginBottom: 4 }}>Führerschein</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {toArr(m.fuehrerschein).map((f: string) => (
                        <span key={f} style={{ display: "inline-block", padding: "2px 8px", borderRadius: 8, fontSize: 11, background: "#e8f5f3", color: ACCENT }}>{f}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Buttons */}
                <div style={{ display: "flex", gap: 8 }}>
                  <button style={{ flex: 1, padding: "8px", borderRadius: 8, border: "1px solid #eee", background: "#fff", cursor: "pointer", fontSize: 12, color: "#555" }} onClick={() => onDetail(m)}>Details</button>
                  <button style={{ flex: 1, padding: "8px", borderRadius: 8, border: "1px solid #eee", background: "#fff", cursor: "pointer", fontSize: 12, color: "#555" }} onClick={() => onEdit("mitarbeiter", m)}>Bearbeiten</button>
                  <button style={{ padding: "8px 12px", borderRadius: 8, border: "none", background: "#E24B4A18", cursor: "pointer", fontSize: 12, color: "#E24B4A" }} onClick={() => onDelete("mitarbeiter", m.id)}>✕</button>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  }

  // ── DESKTOP LAYOUT ────────────────────────────────────────────────────────────
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <button style={C.btnP} onClick={() => onAdd("mitarbeiter")}>+ Mitarbeiter</button>
      </div>
      {gruppen.filter(g => g.members.length > 0).map(g => (
        <div key={g.key} style={{ ...C.card, marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: "#222" }}>{g.key}</span>
            <span style={{ fontSize: 12, color: "#bbb" }}>{g.members.length} Mitarbeiter</span>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
              <colgroup>
                <col style={{ width: "18%" }} /><col style={{ width: "12%" }} />
                <col style={{ width: "22%" }} /><col style={{ width: "13%" }} />
                <col style={{ width: "13%" }} /><col style={{ width: "10%" }} />
                <col style={{ width: "12%" }} />
              </colgroup>
              <thead>
                <tr>
                  <th style={C.th}>Name</th>
                  <th style={C.th}>Rolle</th>
                  <th style={C.th}>Qualifikationen</th>
                  <th style={C.th}>Führerschein</th>
                  <th style={C.th}>Baustelle</th>
                  <th style={C.th}>Status</th>
                  <th style={C.th}></th>
                </tr>
              </thead>
              <tbody>
                {g.members.map((m: any) => (
                  <tr key={m.id}>
                    <td style={C.td}>
                      <div style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.name}</div>
                      <div style={{ fontSize: 11, color: "#bbb" }}>{m.telefon}</div>
                    </td>
                    <td style={C.td}>
                      <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.rolle}</div>
                    </td>
                    <td style={C.td}>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                        {toArr(m.qualifikationen).map((q: string) => <span key={q} style={C.tag}>{q}</span>)}
                      </div>
                    </td>
                    <td style={C.td}>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                        {toArr(m.fuehrerschein).map((f: string) => (
                          <span key={f} style={{ display: "inline-block", padding: "2px 7px", borderRadius: 8, fontSize: 10, background: "#e8f5f3", color: ACCENT }}>{f}</span>
                        ))}
                      </div>
                    </td>
                    <td style={C.td}>
                      <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.baustelle}</div>
                    </td>
                    <td style={C.td}><span style={pill(m.status)}>{m.status}</span></td>
                    <td style={C.td}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                        <button style={{ padding: "3px 8px", borderRadius: 6, border: "1px solid #eee", background: "#fff", cursor: "pointer", fontSize: 11, color: "#555" }} onClick={() => onDetail(m)}>Details</button>
                        <button style={{ padding: "3px 8px", borderRadius: 6, border: "1px solid #eee", background: "#fff", cursor: "pointer", fontSize: 11, color: "#555" }} onClick={() => onEdit("mitarbeiter", m)}>Bearb.</button>
                        <button style={{ padding: "3px 8px", borderRadius: 6, border: "none", background: "#E24B4A18", cursor: "pointer", fontSize: 11, color: "#E24B4A" }} onClick={() => onDelete("mitarbeiter", m.id)}>Löschen</button>
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
