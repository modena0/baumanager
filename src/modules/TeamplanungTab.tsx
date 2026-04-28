import { useState, useEffect } from "react";
import { C, ACCENT } from "../lib/constants";
import { supabase } from "../lib/supabase";

const TEAM_FARBEN = ["#4DB6AC", "#378ADD", "#BA7517", "#E24B4A", "#9C27B0", "#1D9E75"];

interface Team {
  id?: number;
  datum: string;
  team_name: string;
  farbe: string;
  mitarbeiter: number[];
  rotierende: number[];
  baustellen: number[];
  notizen: string;
  erstellt_von: string;
}

export function TeamplanungTab({ data, callAI, currentUser, rolle }: any) {
  const [datum,     setDatum]     = useState(new Date().toISOString().split("T")[0]);
  const [teams,     setTeams]     = useState<Team[]>([]);
  const [loading,   setLoading]   = useState(false);
  const [aiRes,     setAiRes]     = useState("");
  const [aiLoad,    setAiLoad]    = useState(false);
  const [editTeam,  setEditTeam]  = useState<Team|null>(null);
  const [showForm,  setShowForm]  = useState(false);

  const kannPlanen = ["admin", "chef", "polier"].includes(rolle);

  // Teams für gewähltes Datum laden
  useEffect(() => {
    loadTeams();
  }, [datum]);

  async function loadTeams() {
    setLoading(true);
    const { data: d } = await supabase.from("teamplanung").select("*").eq("datum", datum);
    setTeams((d || []).map((t: any) => ({
      ...t,
      mitarbeiter: Array.isArray(t.mitarbeiter) ? t.mitarbeiter.map(Number) : [],
      rotierende:  Array.isArray(t.rotierende)  ? t.rotierende.map(Number)  : [],
      baustellen:  Array.isArray(t.baustellen)  ? t.baustellen.map(Number)  : [],
    })));
    setLoading(false);
  }

  async function saveTeam(team: Team) {
    const p = { ...team, datum, erstellt_von: currentUser?.name || "" };
    if (team.id) {
      await supabase.from("teamplanung").update(p).eq("id", team.id);
      setTeams(ts => ts.map(t => t.id === team.id ? { ...p, id: team.id } : t));
    } else {
      const { data: neu } = await supabase.from("teamplanung").insert([p]).select();
      if (neu) setTeams(ts => [...ts, { ...p, id: neu[0].id }]);
    }
    setEditTeam(null);
    setShowForm(false);
  }

  async function deleteTeam(id: number) {
    await supabase.from("teamplanung").delete().eq("id", id);
    setTeams(ts => ts.filter(t => t.id !== id));
  }

  // Wer ist noch nicht eingeplant?
  const eingeplantIds = teams.flatMap(t => t.mitarbeiter);
  const nichtEingeplant = data.mitarbeiter.filter((m: any) =>
    !eingeplantIds.includes(m.id) && m.status !== "krank" && m.status !== "Urlaub" && m.status !== "gekuendigt"
  );

  // KI-Optimierung
  function kiOptimierung() {
    setAiLoad(true); setAiRes("");
    const ctx = `Du bist ein Bau-Logistik-Experte. Erstelle einen optimalen Teamplan für den ${datum}.
Mitarbeiter: ${JSON.stringify(data.mitarbeiter.map((m: any) => ({ id: m.id, name: m.name, rolle: m.rolle, qualifikationen: m.qualifikationen, fuehrerschein: m.fuehrerschein, status: m.status, gutMit: m.gutMit, nichtMit: m.nichtMit })))}
Baustellen: ${JSON.stringify(data.baustellen.filter((b: any) => b.status !== "abgeschlossen").map((b: any) => ({ id: b.id, name: b.name, anforderungen: b.anforderungen })))}
Regeln: 
- nichtMit Mitarbeiter NIEMALS im gleichen Team
- LKW-Fahrer können rotierend sein
- Teams von 2-4 Personen
- Qualifikationen der Mitarbeiter mit Baustellen-Anforderungen abgleichen
Antworte auf Deutsch mit konkreten Team-Vorschlägen.`;

    fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 800, messages: [{ role: "user", content: ctx }] })
    })
      .then(r => r.json())
      .then(d => setAiRes((d.content && d.content[0] && d.content[0].text) || "Keine Antwort."))
      .catch(e => setAiRes("Fehler: " + e.message))
      .finally(() => setAiLoad(false));
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <input type="date" value={datum} onChange={e => setDatum(e.target.value)}
            style={{ ...C.inp, marginBottom: 0, width: "auto", padding: "8px 12px" }} />
          <div style={{ fontSize: 12, color: "#888" }}>
            {teams.length} Teams · {eingeplantIds.length} Mitarbeiter eingeplant
          </div>
        </div>
        {kannPlanen && (
          <div style={{ display: "flex", gap: 8 }}>
            <button style={{ ...C.btnS }} onClick={kiOptimierung}>✦ KI-Vorschlag</button>
            <button style={{ ...C.btnP }} onClick={() => { setEditTeam({ datum, team_name: "", farbe: TEAM_FARBEN[teams.length % TEAM_FARBEN.length], mitarbeiter: [], rotierende: [], baustellen: [], notizen: "", erstellt_von: "" }); setShowForm(true); }}>
              + Neues Team
            </button>
          </div>
        )}
      </div>

      {/* KI Vorschlag */}
      {(aiLoad || aiRes) && (
        <div style={{ ...C.card, marginBottom: 16, background: "#f8fffe", border: "1px solid " + ACCENT + "44" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: ACCENT }}>✦ KI-Teamvorschlag</span>
            <button onClick={() => setAiRes("")} style={{ background: "none", border: "none", cursor: "pointer", color: "#bbb", fontSize: 16 }}>✕</button>
          </div>
          <div style={{ fontSize: 13, lineHeight: 1.7, color: aiLoad ? "#bbb" : "#444", whiteSpace: "pre-wrap" }}>
            {aiLoad ? "KI erstellt Teamvorschlag..." : aiRes}
          </div>
        </div>
      )}

      {/* Teams */}
      {loading ? (
        <div style={{ textAlign: "center", color: "#bbb", padding: 32 }}>Lädt...</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 14 }}>
          {teams.map(team => (
            <TeamKarte
              key={team.id}
              team={team}
              data={data}
              kannPlanen={kannPlanen}
              onEdit={() => { setEditTeam(team); setShowForm(true); }}
              onDelete={() => deleteTeam(team.id!)}
            />
          ))}

          {teams.length === 0 && (
            <div style={{ ...C.card, textAlign: "center", padding: 40, color: "#bbb", gridColumn: "1/-1" }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>👷</div>
              <div style={{ fontSize: 14, marginBottom: 4 }}>Noch keine Teams für diesen Tag</div>
              {kannPlanen && <div style={{ fontSize: 12 }}>Klicke "+ Neues Team" oder nutze den KI-Vorschlag</div>}
            </div>
          )}
        </div>
      )}

      {/* Nicht eingeplante Mitarbeiter */}
      {nichtEingeplant.length > 0 && (
        <div style={{ ...C.card, marginTop: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#E24B4A", marginBottom: 10 }}>
            ⚠ Nicht eingeplant ({nichtEingeplant.length})
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {nichtEingeplant.map((m: any) => (
              <div key={m.id} style={{ padding: "5px 10px", borderRadius: 8, background: "#fff3f3", border: "1px solid #E24B4A44", fontSize: 12, color: "#E24B4A" }}>
                {m.name} · {m.rolle}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Team Formular Modal */}
      {showForm && editTeam && (
        <TeamFormular
          team={editTeam}
          data={data}
          onSave={saveTeam}
          onClose={() => { setShowForm(false); setEditTeam(null); }}
        />
      )}
    </div>
  );
}

// ── Team Karte ─────────────────────────────────────────────────────────────────
function TeamKarte({ team, data, kannPlanen, onEdit, onDelete }: any) {
  const getMa = (id: number) => data.mitarbeiter.find((m: any) => m.id === id);
  const getBS = (id: number) => data.baustellen.find((b: any) => b.id === id);

  return (
    <div style={{ ...C.card, borderTop: "4px solid " + team.farbe, padding: "16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#222" }}>{team.team_name}</div>
          <div style={{ fontSize: 11, color: "#bbb", marginTop: 2 }}>{team.mitarbeiter.length} Mitarbeiter · {team.baustellen.length} Baustellen</div>
        </div>
        {kannPlanen && (
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={onEdit} style={{ padding: "4px 10px", borderRadius: 7, border: "1px solid #eee", background: "#fff", cursor: "pointer", fontSize: 11, color: "#555" }}>✎</button>
            <button onClick={onDelete} style={{ padding: "4px 10px", borderRadius: 7, border: "none", background: "#E24B4A18", cursor: "pointer", fontSize: 11, color: "#E24B4A" }}>✕</button>
          </div>
        )}
      </div>

      {/* Mitarbeiter */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "#888", marginBottom: 6 }}>MITARBEITER</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
          {team.mitarbeiter.map((id: number) => {
            const m = getMa(id);
            if (!m) return null;
            const isRot = team.rotierende.includes(id);
            return (
              <div key={id} style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 8px", borderRadius: 8, background: isRot ? "#fff3e0" : "#e8f5f3", border: "1px solid " + (isRot ? "#BA751744" : team.farbe + "44") }}>
                <span style={{ fontSize: 12, fontWeight: 500, color: isRot ? "#BA7517" : ACCENT }}>{m.name}</span>
                {isRot && <span style={{ fontSize: 9, color: "#BA7517" }}>↻</span>}
              </div>
            );
          })}
          {team.mitarbeiter.length === 0 && <div style={{ fontSize: 12, color: "#bbb" }}>Keine</div>}
        </div>
      </div>

      {/* Baustellen */}
      <div style={{ marginBottom: team.notizen ? 10 : 0 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "#888", marginBottom: 6 }}>BAUSTELLEN</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
          {team.baustellen.map((id: number) => {
            const b = getBS(id);
            if (!b) return null;
            return (
              <div key={id} style={{ padding: "4px 8px", borderRadius: 8, background: "#f0f4f3", border: "1px solid #e8eaed", fontSize: 12, color: "#444" }}>
                ⛏ {b.name}
              </div>
            );
          })}
          {team.baustellen.length === 0 && <div style={{ fontSize: 12, color: "#bbb" }}>Keine</div>}
        </div>
      </div>

      {/* Notizen */}
      {team.notizen && (
        <div style={{ marginTop: 10, padding: "8px 10px", background: "#f8f8f8", borderRadius: 8, fontSize: 12, color: "#666", fontStyle: "italic" }}>
          {team.notizen}
        </div>
      )}
    </div>
  );
}

// ── Team Formular ──────────────────────────────────────────────────────────────
function TeamFormular({ team, data, onSave, onClose }: any) {
  const [f, setF] = useState<Team>({ ...team });
  const isMobile = window.innerWidth < 768;

  const toggleMA = (id: number) => {
    setF(t => ({
      ...t,
      mitarbeiter: t.mitarbeiter.includes(id)
        ? t.mitarbeiter.filter(i => i !== id)
        : [...t.mitarbeiter, id],
      rotierende: t.mitarbeiter.includes(id)
        ? t.rotierende.filter(i => i !== id)
        : t.rotierende,
    }));
  };

  const toggleRot = (id: number) => {
    if (!f.mitarbeiter.includes(id)) return;
    setF(t => ({
      ...t,
      rotierende: t.rotierende.includes(id)
        ? t.rotierende.filter(i => i !== id)
        : [...t.rotierende, id],
    }));
  };

  const toggleBS = (id: number) => {
    setF(t => ({
      ...t,
      baustellen: t.baustellen.includes(id)
        ? t.baustellen.filter(i => i !== id)
        : [...t.baustellen, id],
    }));
  };

  const aktiveMa = data.mitarbeiter.filter((m: any) =>
    m.status !== "krank" && m.status !== "Urlaub" && m.status !== "gekuendigt"
  );
  const aktiveBS = data.baustellen.filter((b: any) => b.status !== "abgeschlossen");

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: isMobile ? "flex-end" : "center", justifyContent: "center", zIndex: 9999 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ ...C.card, width: isMobile ? "100%" : "min(600px,95vw)", maxHeight: isMobile ? "92vh" : "90vh", overflowY: "auto", borderRadius: isMobile ? "20px 20px 0 0" : 16, padding: isMobile ? "20px 16px 32px" : 24, margin: 0 }}>

        {isMobile && <div style={{ width: 40, height: 4, background: "#ddd", borderRadius: 2, margin: "0 auto 16px" }} />}

        <div style={{ fontSize: 17, fontWeight: 700, color: "#222", marginBottom: 20, paddingBottom: 12, borderBottom: "1px solid #f5f5f5" }}>
          {team.id ? "Team bearbeiten" : "Neues Team"}
        </div>

        {/* Team Name + Farbe */}
        <div style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "flex-end" }}>
          <div style={{ flex: 1 }}>
            <label style={C.lbl}>Team Name</label>
            <input style={C.inp} value={f.team_name} onChange={e => setF(t => ({ ...t, team_name: e.target.value }))} placeholder="z.B. Team Rot" />
          </div>
          <div>
            <label style={C.lbl}>Farbe</label>
            <div style={{ display: "flex", gap: 5, marginBottom: 8 }}>
              {TEAM_FARBEN.map(c => (
                <button key={c} onClick={() => setF(t => ({ ...t, farbe: c }))}
                  style={{ width: 28, height: 28, borderRadius: "50%", background: c, border: f.farbe === c ? "3px solid #222" : "2px solid transparent", cursor: "pointer" }} />
              ))}
            </div>
          </div>
        </div>

        {/* Mitarbeiter auswählen */}
        <div style={{ marginBottom: 16 }}>
          <label style={C.lbl}>Mitarbeiter ({f.mitarbeiter.length} ausgewählt)</label>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 200, overflowY: "auto", border: "1px solid #e8eaed", borderRadius: 10, padding: 8 }}>
            {aktiveMa.map((m: any) => {
              const selected = f.mitarbeiter.includes(m.id);
              const isRot = f.rotierende.includes(m.id);
              return (
                <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", borderRadius: 8, background: selected ? "#e8f5f3" : "#fff", border: "1px solid " + (selected ? ACCENT + "44" : "#eee") }}>
                  <input type="checkbox" checked={selected} onChange={() => toggleMA(m.id)}
                    style={{ width: 16, height: 16, accentColor: ACCENT, cursor: "pointer" }} />
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: 13, fontWeight: selected ? 600 : 400, color: selected ? ACCENT : "#333" }}>{m.name}</span>
                    <span style={{ fontSize: 11, color: "#aaa", marginLeft: 6 }}>{m.rolle}</span>
                  </div>
                  {selected && (
                    <button onClick={() => toggleRot(m.id)}
                      style={{ padding: "2px 8px", borderRadius: 6, border: "1px solid " + (isRot ? "#BA7517" : "#eee"), background: isRot ? "#fff3e0" : "#fff", cursor: "pointer", fontSize: 11, color: isRot ? "#BA7517" : "#aaa" }}>
                      {isRot ? "↻ Rotierend" : "Rotierend?"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Baustellen auswählen */}
        <div style={{ marginBottom: 16 }}>
          <label style={C.lbl}>Baustellen ({f.baustellen.length} ausgewählt)</label>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 160, overflowY: "auto", border: "1px solid #e8eaed", borderRadius: 10, padding: 8 }}>
            {aktiveBS.map((b: any) => {
              const selected = f.baustellen.includes(b.id);
              return (
                <div key={b.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", borderRadius: 8, background: selected ? "#e8f5f3" : "#fff", border: "1px solid " + (selected ? ACCENT + "44" : "#eee") }}>
                  <input type="checkbox" checked={selected} onChange={() => toggleBS(b.id)}
                    style={{ width: 16, height: 16, accentColor: ACCENT, cursor: "pointer" }} />
                  <span style={{ fontSize: 13, fontWeight: selected ? 600 : 400, color: selected ? ACCENT : "#333" }}>⛏ {b.name}</span>
                  {b.ort && <span style={{ fontSize: 11, color: "#aaa" }}>{b.ort}</span>}
                </div>
              );
            })}
          </div>
        </div>

        {/* Notizen */}
        <div style={{ marginBottom: 20 }}>
          <label style={C.lbl}>Notizen (optional)</label>
          <input style={C.inp} value={f.notizen} onChange={e => setF(t => ({ ...t, notizen: e.target.value }))} placeholder="z.B. LKW-Fahrer rotiert zwischen Baustelle A und B" />
        </div>

        {/* Buttons */}
        <div style={{ display: "flex", gap: 8 }}>
          <button style={{ ...C.btnS, flex: 1 }} onClick={onClose}>Abbrechen</button>
          <button style={{ ...C.btnP, flex: 1, opacity: !f.team_name ? 0.5 : 1 }}
            onClick={() => { if (f.team_name) onSave(f); }}>
            Speichern
          </button>
        </div>
      </div>
    </div>
  );
}
