import { useState } from "react";
import { C, ACCENT } from "../lib/constants";

export function ZuordnungsBoard({ data, setData, callAI, isMobile }: any) {
  const [dragId,  setDragId]  = useState<number|null>(null);
  const [aiRes,   setAiRes]   = useState("");
  const [aiLoad,  setAiLoad]  = useState(false);
  const [selMa,   setSelMa]   = useState<number|null>(null); // für Mobile: ausgewählter MA

  const getMa = (id: number) => data.mitarbeiter.find((m: any) => m.id === id);

  const drop = (bsId: number, maId: number) => {
    setData((d: any) => {
      const nb = d.baustellen.map((b: any) => {
        const t = b.mitarbeiter.filter((id: number) => id !== maId);
        return b.id === bsId ? { ...b, mitarbeiter: [...t, maId] } : { ...b, mitarbeiter: t };
      });
      const tBS = nb.find((b: any) => b.id === bsId);
      return {
        ...d,
        baustellen: nb,
        mitarbeiter: d.mitarbeiter.map((m: any) =>
          m.id !== maId ? m : { ...m, baustelle: bsId === 0 ? "-" : (tBS ? tBS.name : "-") }
        ),
      };
    });
    setDragId(null);
    setSelMa(null);
  };

  const remMa = (bsId: number, maId: number) => setData((d: any) => ({
    ...d,
    baustellen: d.baustellen.map((b: any) => b.id !== bsId ? b : { ...b, mitarbeiter: b.mitarbeiter.filter((i: number) => i !== maId) }),
    mitarbeiter: d.mitarbeiter.map((m: any) => m.id !== maId ? m : { ...m, baustelle: "-" }),
  }));

  const unass = data.mitarbeiter.filter((m: any) => !data.baustellen.some((b: any) => b.mitarbeiter.includes(m.id)));

  // ── MOBILE LAYOUT: Tippen statt Drag & Drop ───────────────────────────────────
  if (isMobile) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

        {/* Anleitung */}
        <div style={{ background: ACCENT + "18", borderRadius: 10, padding: "10px 14px", fontSize: 12, color: ACCENT, fontWeight: 500 }}>
          💡 Tippe einen Mitarbeiter an, dann wähle eine Baustelle zum Zuweisen.
        </div>

        {/* Nicht zugeordnete Mitarbeiter */}
        <div style={{ ...C.card }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#888", marginBottom: 10, textTransform: "uppercase" as any }}>
            Nicht zugeordnet ({unass.length})
          </div>
          {unass.length === 0 && <div style={{ fontSize: 12, color: "#bbb", textAlign: "center", padding: 8 }}>Alle zugeordnet ✓</div>}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {unass.map((m: any) => (
              <button key={m.id}
                onClick={() => setSelMa(selMa === m.id ? null : m.id)}
                style={{
                  background: selMa === m.id ? ACCENT : "#f8fffe",
                  border: "1.5px solid " + (selMa === m.id ? ACCENT : "#e8f5f3"),
                  borderRadius: 10, padding: "8px 12px", cursor: "pointer", textAlign: "left",
                }}
              >
                <div style={{ fontWeight: 600, fontSize: 13, color: selMa === m.id ? "#fff" : "#222" }}>{m.name}</div>
                <div style={{ fontSize: 11, color: selMa === m.id ? "rgba(255,255,255,0.7)" : "#bbb" }}>{m.rolle}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Baustellen – mit Zuweisung per Tipp */}
        {data.baustellen.map((b: any) => {
          const team = b.mitarbeiter.map(getMa).filter(Boolean);
          const kannZuweisen = selMa !== null && !b.mitarbeiter.includes(selMa);
          return (
            <div key={b.id} style={{ ...C.card, border: kannZuweisen ? "2px solid " + ACCENT : "1px solid #e8f5f3" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>{b.name}</span>
                <span style={{ fontSize: 11, color: "#bbb" }}>{team.length} MA</span>
              </div>

              {/* Team */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: kannZuweisen ? 10 : 0 }}>
                {team.length === 0 && !kannZuweisen && (
                  <div style={{ fontSize: 12, color: "#bbb", width: "100%", textAlign: "center", padding: 4 }}>Keine Mitarbeiter</div>
                )}
                {team.map((m: any) => (
                  <div key={m.id} style={{ background: "#e8f5f3", borderRadius: 8, padding: "6px 10px", display: "flex", gap: 6, alignItems: "center" }}>
                    <span style={{ fontSize: 12, fontWeight: 500, color: ACCENT }}>{m.name}</span>
                    <button onClick={() => remMa(b.id, m.id)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, color: "#bbb", padding: 0 }}>✕</button>
                  </div>
                ))}
              </div>

              {/* Zuweisen Button – erscheint wenn MA ausgewählt */}
              {kannZuweisen && (
                <button
                  onClick={() => drop(b.id, selMa!)}
                  style={{ width: "100%", padding: "10px", borderRadius: 10, border: "none", background: ACCENT, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                >
                  + {getMa(selMa!)?.name} hier zuweisen
                </button>
              )}
            </div>
          );
        })}

        {/* KI Optimierung */}
        <div style={{ ...C.card }}>
          <button style={{ ...C.btnP, width: "100%", padding: "12px" }}
            onClick={() => callAI("Optimale Mitarbeiterzuordnung. nichtMit NIEMALS zusammen.", setAiRes, setAiLoad)}
          >
            ✦ KI-Optimierung starten
          </button>
          {(aiRes || aiLoad) && (
            <div style={{ background: "#f8fffe", borderRadius: 10, padding: 14, marginTop: 10, fontSize: 13, lineHeight: 1.75, color: "#444", whiteSpace: "pre-wrap", border: "1px solid #e8f5f3" }}>
              {aiLoad ? "KI analysiert..." : aiRes}
            </div>
          )}
        </div>

      </div>
    );
  }

  // ── DESKTOP LAYOUT: Drag & Drop ───────────────────────────────────────────────
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 16, alignItems: "start" }}>

        {/* Nicht zugeordnet */}
        <div style={C.card}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#888", marginBottom: 10, textTransform: "uppercase" as any }}>Nicht zugeordnet</div>
          <div
            style={{ minHeight: 60, borderRadius: 10, border: "2px dashed #e0e0e0", padding: 8 }}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); if (dragId) drop(0, dragId); }}
          >
            {unass.map((m: any) => (
              <div key={m.id} draggable onDragStart={() => setDragId(m.id)}
                style={{ background: "#f8fffe", border: "1px solid #e8f5f3", borderRadius: 8, padding: "7px 10px", marginBottom: 5, cursor: "grab" }}
              >
                <div style={{ fontWeight: 500, fontSize: 12 }}>{m.name}</div>
                <div style={{ fontSize: 11, color: "#bbb" }}>{m.rolle}</div>
              </div>
            ))}
            {unass.length === 0 && <div style={{ fontSize: 12, color: "#bbb", textAlign: "center", padding: 8 }}>Alle zugeordnet</div>}
          </div>
        </div>

        {/* Baustellen */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {data.baustellen.map((b: any) => {
            const team = b.mitarbeiter.map(getMa).filter(Boolean);
            return (
              <div key={b.id} style={{ ...C.card, border: "1px solid #e8f5f3" }}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); if (dragId) drop(b.id, dragId); }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{b.name}</span>
                  <span style={{ fontSize: 11, color: "#bbb" }}>{team.length} MA</span>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, minHeight: 36 }}>
                  {team.length === 0 && <div style={{ fontSize: 12, color: "#bbb", width: "100%", textAlign: "center" }}>Hierher ziehen</div>}
                  {team.map((m: any) => (
                    <div key={m.id} draggable onDragStart={() => setDragId(m.id)}
                      style={{ background: "#e8f5f3", borderRadius: 8, padding: "6px 10px", cursor: "grab", display: "flex", gap: 6, alignItems: "center" }}
                    >
                      <span style={{ fontSize: 12, fontWeight: 500, color: ACCENT }}>{m.name}</span>
                      <button onClick={() => remMa(b.id, m.id)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: "#bbb" }}>✕</button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ marginTop: 14, display: "flex", gap: 8 }}>
        <button style={C.btnP} onClick={() => callAI("Optimale Mitarbeiterzuordnung. nichtMit NIEMALS zusammen.", setAiRes, setAiLoad)}>
          KI-Optimierung
        </button>
        <span style={{ fontSize: 12, color: "#bbb", alignSelf: "center" }}>Drag & Drop zum Zuweisen</span>
      </div>

      {(aiRes || aiLoad) && (
        <div style={{ background: "#f8fffe", borderRadius: 10, padding: 14, marginTop: 10, fontSize: 13, lineHeight: 1.75, color: "#444", whiteSpace: "pre-wrap", border: "1px solid #e8f5f3" }}>
          {aiLoad ? "KI analysiert..." : aiRes}
        </div>
      )}
    </div>
  );
}
