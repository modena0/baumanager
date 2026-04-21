import { useState } from "react";
import { C, ACCENT } from "../lib/constants";
import { getProgress } from "../lib/utils";
import { Kalender } from "../components/Kalender";

export function Dashboard({ data, setTab, saveTermin, deleteTermin }: any) {
  const [aiRes, setAiRes]   = useState("");
  const [aiLoad, setAiLoad] = useState(false);
  const [frage, setFrage]   = useState("");

  const bsColors = ["#b2dfdb","#80cbc4","#4DB6AC","#26a69a","#00897b"];
  const today = new Date().toISOString().split("T")[0];
  const heuteTermine = (data.termine || []).filter((t: any) => t.datum === today);

  const sorted = data.baustellen
    .filter((b: any) => b.status !== "abgeschlossen")
    .sort((a: any, b: any) =>
      Math.ceil((new Date(a.ende).getTime() - Date.now()) / 86400000) -
      Math.ceil((new Date(b.ende).getTime() - Date.now()) / 86400000)
    );

  const ask = (p: string) => {
    setAiLoad(true); setAiRes("");
    const ctx = "Kurze Antwort auf Deutsch. Daten:" + JSON.stringify({
      baustellen: data.baustellen.map((b: any) => ({ name: b.name, status: b.status, fortschritt: getProgress(b) })),
      fahrzeuge: data.fahrzeuge,
      mitarbeiter: data.mitarbeiter.map((m: any) => ({ name: m.name, status: m.status, baustelle: m.baustelle })),
    });
    fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 400, system: ctx, messages: [{ role: "user", content: p }] }),
    })
      .then(r => r.json())
      .then(d => setAiRes((d.content && d.content[0] && d.content[0].text) || "Keine Antwort."))
      .catch(e => setAiRes("Fehler: " + e.message))
      .finally(() => setAiLoad(false));
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 14, alignItems: "start" }}>

      {/* ── LINKE SPALTE ─────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

        {/* Aktive Baustellen – max-height + scroll */}
        <div style={{ ...C.card }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#222" }}>Aktive Baustellen</span>
            <button onClick={() => setTab(3)} style={{ fontSize: 11, color: ACCENT, background: "none", border: "none", cursor: "pointer", fontWeight: 500 }}>Alle anzeigen →</button>
          </div>

          {/* Scrollbarer Bereich mit fester max-height */}
          <div style={{ maxHeight: 280, overflowY: "auto", paddingRight: 2 }}>
            {sorted.map((b: any, idx: number) => {
              const col = bsColors[idx % bsColors.length];
              const prog = getProgress(b);
              const auf = b.aufgaben || [];
              const done = auf.filter((a: any) => a.erledigt).length;
              const dl = Math.ceil((new Date(b.ende).getTime() - Date.now()) / 86400000);
              return (
                <div key={b.id} style={{
                  background: col + "28",
                  borderRadius: 8,
                  padding: "7px 10px",
                  marginBottom: 6,
                  border: "1.5px solid " + col,
                  transition: "transform 0.12s, box-shadow 0.12s",
                }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 3px 10px rgba(0,0,0,0.07)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ""; (e.currentTarget as HTMLElement).style.boxShadow = ""; }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                    <div>
                      <span style={{ fontWeight: 600, fontSize: 12, color: "#222" }}>{b.name}</span>
                      <span style={{ fontSize: 10, color: "#888", marginLeft: 6 }}>{b.ort}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: ACCENT }}>{prog}%</span>
                      <span style={{ fontSize: 9, color: dl <= 14 ? "#E24B4A" : "#bbb" }}>{dl}d</span>
                    </div>
                  </div>
                  <div style={{ height: 3, background: "rgba(0,0,0,0.08)", borderRadius: 2, marginBottom: 4 }}>
                    <div style={{ height: "100%", width: prog + "%", background: ACCENT, borderRadius: 2 }} />
                  </div>
                  {auf.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 3, alignItems: "center" }}>
                      {auf.slice(0, 3).map((a: any) => (
                        <span key={a.id} style={{ fontSize: 9, padding: "1px 5px", borderRadius: 6, background: a.erledigt ? ACCENT + "22" : "#f0f0f0", color: a.erledigt ? ACCENT : "#aaa", textDecoration: a.erledigt ? "line-through" : "none" }}>{a.titel}</span>
                      ))}
                      {auf.length > 3 && <span style={{ fontSize: 9, color: "#bbb" }}>+{auf.length - 3}</span>}
                      <span style={{ fontSize: 9, color: "#bbb", marginLeft: "auto" }}>{done}/{auf.length} ✓</span>
                    </div>
                  )}
                  {auf.length === 0 && <div style={{ fontSize: 9, color: "#ccc", fontStyle: "italic" }}>Keine Aufgaben</div>}
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* ── RECHTE SPALTE ────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

        {/* Kalender */}
        <div style={{ ...C.card }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#222" }}>Kalender</span>
            <button onClick={() => setTab(4)} style={{ fontSize: 11, color: ACCENT, background: "none", border: "none", cursor: "pointer", fontWeight: 500 }}>Vollansicht</button>
          </div>
          <Kalender termine={data.termine || []} onSave={saveTermin} onDelete={deleteTermin} compact={true} baustellen={data.baustellen} />
        </div>

        {/* Heute */}
        {heuteTermine.length > 0 && (
          <div style={{ ...C.card }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#222", marginBottom: 8 }}>📅 Heute</div>
            {heuteTermine.map((t: any) => (
              <div key={t.id} style={{ display: "flex", gap: 8, padding: "5px 0", borderBottom: "1px solid #f5f5f5", alignItems: "center" }}>
                <div style={{ width: 3, minHeight: 24, borderRadius: 2, background: t.art === "Pflichttermin" ? "#E24B4A" : ACCENT, flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#222" }}>{t.titel}</div>
                  <div style={{ fontSize: 10, color: "#aaa" }}>{t.uhrzeit} – {t.art} – {t.baustelle}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* KI Hilfe */}
        <div style={{ ...C.card }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#222", marginBottom: 8 }}>✦ KI Hilfe</div>
          <div style={{ display: "flex", gap: 4, marginBottom: 7, flexWrap: "wrap" }}>
            {[["Auslastung", "Kurze Zusammenfassung der aktuellen Auslastung."], ["Engpässe", "Kritische Engpaesse?"], ["Heute", "Was sollte ich heute zuerst tun?"]].map(q => (
              <button key={q[0]} onClick={() => ask(q[1])} style={{ padding: "3px 9px", borderRadius: 14, background: "#f0faf9", border: "1px solid " + ACCENT + "44", color: ACCENT, cursor: "pointer", fontSize: 10, fontWeight: 500 }}>{q[0]}</button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 5, marginBottom: 7 }}>
            <input
              style={{ ...C.inp, marginBottom: 0, flex: 1, fontSize: 11, padding: "6px 10px" }}
              value={frage}
              onChange={e => setFrage(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && frage) ask(frage); }}
              placeholder="Frage stellen..."
            />
            <button onClick={() => { if (frage) ask(frage); }} style={{ padding: "6px 10px", borderRadius: 8, border: "none", background: ACCENT, cursor: "pointer", fontSize: 12, color: "#fff", fontWeight: 600, flexShrink: 0 }}>→</button>
          </div>
          <div style={{ background: "#f8fffe", borderRadius: 8, padding: "8px 10px", minHeight: 44, fontSize: 11, lineHeight: 1.6, color: aiLoad ? "#bbb" : "#444", whiteSpace: "pre-wrap", border: "1px solid #e8f5f3" }}>
            {aiLoad ? "KI analysiert..." : aiRes || "Stelle eine Frage."}
          </div>
        </div>

      </div>
    </div>
  );
}
