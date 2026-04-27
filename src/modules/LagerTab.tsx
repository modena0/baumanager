import { C, ACCENT } from "../lib/constants";

export function LagerTab({ data, openAdd, openEdit, deleteItem, isMobile }: any) {

  // Kategorien für Gruppierung
  const kategorien = [...new Set(data.lager.map((l: any) => l.kategorie || "Sonstiges"))];

  // ── MOBILE LAYOUT ─────────────────────────────────────────────────────────────
  if (isMobile) {
    return (
      <div>
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
          <button style={{ ...C.btnP, padding: "10px 20px" }} onClick={() => openAdd("lager")}>+ Artikel</button>
        </div>

        {data.lager.map((l: any) => {
          const krit = (l.verfuegbar || 0) <= (l.mindestbestand || 0);
          const prozent = l.anzahl > 0 ? Math.round((l.verfuegbar / l.anzahl) * 100) : 0;
          return (
            <div key={l.id} style={{ ...C.card, marginBottom: 10, padding: "14px 16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: "#222" }}>{l.name}</div>
                  {l.kategorie && <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>{l.kategorie}</div>}
                  {l.zugewiesen && <div style={{ fontSize: 11, color: ACCENT, marginTop: 2 }}>📍 {l.zugewiesen}</div>}
                </div>
                {krit && (
                  <span style={{ background: "#E24B4A18", color: "#E24B4A", borderRadius: 8, padding: "3px 8px", fontSize: 10, fontWeight: 600, flexShrink: 0 }}>
                    ⚠ Kritisch
                  </span>
                )}
              </div>

              {/* Bestand Anzeige */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 10 }}>
                <div style={{ textAlign: "center", background: "#f8f8f8", borderRadius: 8, padding: "8px 4px" }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "#333" }}>{l.anzahl || 0}</div>
                  <div style={{ fontSize: 10, color: "#bbb" }}>Gesamt</div>
                </div>
                <div style={{ textAlign: "center", background: krit ? "#E24B4A12" : "#e8f5f3", borderRadius: 8, padding: "8px 4px" }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: krit ? "#E24B4A" : ACCENT }}>{l.verfuegbar || 0}</div>
                  <div style={{ fontSize: 10, color: "#bbb" }}>Verfügbar</div>
                </div>
                <div style={{ textAlign: "center", background: "#f8f8f8", borderRadius: 8, padding: "8px 4px" }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "#333" }}>{l.mindestbestand || 0}</div>
                  <div style={{ fontSize: 10, color: "#bbb" }}>Mindest</div>
                </div>
              </div>

              {/* Fortschrittsbalken */}
              <div style={{ height: 6, background: "#eee", borderRadius: 3, marginBottom: 12 }}>
                <div style={{ height: "100%", width: prozent + "%", background: krit ? "#E24B4A" : ACCENT, borderRadius: 3, transition: "width 0.3s" }} />
              </div>

              {/* Buttons */}
              <div style={{ display: "flex", gap: 8 }}>
                <button style={{ flex: 1, padding: "9px", borderRadius: 8, border: "1.5px solid #eee", background: "#fff", cursor: "pointer", fontSize: 12, color: "#555" }} onClick={() => openEdit("lager", l)}>✎ Bearbeiten</button>
                <button style={{ padding: "9px 14px", borderRadius: 8, border: "none", background: "#E24B4A18", cursor: "pointer", fontSize: 12, color: "#E24B4A" }} onClick={() => deleteItem("lager", l.id)}>✕</button>
              </div>
            </div>
          );
        })}

        {data.lager.length === 0 && (
          <div style={{ ...C.card, textAlign: "center", padding: 32, color: "#bbb" }}>
            Noch keine Artikel im Lager
          </div>
        )}
      </div>
    );
  }

  // ── DESKTOP LAYOUT ────────────────────────────────────────────────────────────
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <button style={C.btnP} onClick={() => openAdd("lager")}>+ Artikel</button>
      </div>
      <div style={C.card}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={C.th}>Artikel</th>
              <th style={C.th}>Kategorie</th>
              <th style={C.th}>Gesamt</th>
              <th style={C.th}>Verfügbar</th>
              <th style={C.th}>Mindestbestand</th>
              <th style={C.th}>Zugewiesen</th>
              <th style={C.th}></th>
            </tr>
          </thead>
          <tbody>
            {data.lager.map((l: any) => {
              const krit = (l.verfuegbar || 0) <= (l.mindestbestand || 0);
              return (
                <tr key={l.id} style={{ background: krit ? "#E24B4A08" : "transparent" }}>
                  <td style={C.td}>
                    <div style={{ fontWeight: 500 }}>{l.name}</div>
                    {krit && <div style={{ fontSize: 10, color: "#E24B4A", marginTop: 2 }}>⚠ Kritischer Bestand</div>}
                  </td>
                  <td style={C.td}>{l.kategorie}</td>
                  <td style={C.td}>{l.anzahl}</td>
                  <td style={C.td}>
                    <span style={{ color: krit ? "#E24B4A" : ACCENT, fontWeight: 600 }}>{l.verfuegbar}</span>
                  </td>
                  <td style={C.td}>{l.mindestbestand}</td>
                  <td style={C.td}>{l.zugewiesen}</td>
                  <td style={C.td}>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button style={{ padding: "4px 10px", borderRadius: 8, border: "1.5px solid #eee", background: "#fff", cursor: "pointer", fontSize: 11, color: "#555" }} onClick={() => openEdit("lager", l)}>✎</button>
                      <button style={{ padding: "4px 10px", borderRadius: 8, border: "none", background: "#E24B4A18", cursor: "pointer", fontSize: 11, color: "#E24B4A" }} onClick={() => deleteItem("lager", l.id)}>✕</button>
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
