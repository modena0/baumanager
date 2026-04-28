import { useState, useEffect } from "react";
import { C, ACCENT } from "../lib/constants";
import { supabase } from "../lib/supabase";

const TEAM_FARBEN = ["#4DB6AC", "#378ADD", "#BA7517", "#E24B4A", "#9C27B0", "#1D9E75", "#607D8B"];
const SPEZIALISIERUNGEN = ["FGU-Bau", "Tiefbau", "Asphalt", "Straßenbau", "LSA", "Pflaster", "Brücke", "Kanal", "Sonstiges"];

interface Team {
  id?: number;
  datum: string;
  datum_bis?: string | null;
  ist_dauerhaft: boolean;
  spezialisierung?: string | null;
  team_name: string;
  farbe: string;
  mitarbeiter: number[];
  rotierende: number[];
  baustellen: number[];
  notizen: string;
  erstellt_von: string;
}

interface Chemie {
  id: number;
  mitarbeiter_a: number;
  mitarbeiter_b: number;
  zusammen_count: number;
  priorisiert: boolean;
}

export function TeamplanungTab({ data, currentUser, rolle }: any) {
  const [datum,      setDatum]      = useState(new Date().toISOString().split("T")[0]);
  const [teams,      setTeams]      = useState<Team[]>([]);
  const [chemie,     setChemie]     = useState<Chemie[]>([]);
  const [loading,    setLoading]    = useState(false);
  const [kiLoading,  setKiLoading]  = useState(false);
  const [editTeam,   setEditTeam]   = useState<Team|null>(null);
  const [showForm,   setShowForm]   = useState(false);
  const [showChemie, setShowChemie] = useState(false);

  const kannPlanen = ["admin", "chef", "polier"].includes(rolle);

  useEffect(() => { loadAll(); }, [datum]);

  async function loadAll() {
    setLoading(true);
    const { data: d } = await supabase.from("teamplanung").select("*");
    const heute = new Date(datum);
    const gefiltert = (d || []).filter((t: any) => {
      if (t.ist_dauerhaft) {
        const von = new Date(t.datum);
        const bis = t.datum_bis ? new Date(t.datum_bis) : new Date(t.datum);
        return heute >= von && heute <= bis;
      }
      return t.datum === datum;
    });
    setTeams(gefiltert.map((t: any) => ({
      ...t,
      mitarbeiter: Array.isArray(t.mitarbeiter) ? t.mitarbeiter.map(Number) : [],
      rotierende:  Array.isArray(t.rotierende)  ? t.rotierende.map(Number)  : [],
      baustellen:  Array.isArray(t.baustellen)  ? t.baustellen.map(Number)  : [],
    })));
    const { data: c } = await supabase.from("team_chemie").select("*").order("zusammen_count", { ascending: false });
    setChemie(c || []);
    setLoading(false);
  }

  async function updateChemie(mitarbeiter: number[]) {
    for (let i = 0; i < mitarbeiter.length; i++) {
      for (let j = i + 1; j < mitarbeiter.length; j++) {
        const a = Math.min(mitarbeiter[i], mitarbeiter[j]);
        const b = Math.max(mitarbeiter[i], mitarbeiter[j]);
        const existing = chemie.find(c => c.mitarbeiter_a === a && c.mitarbeiter_b === b);
        if (existing) {
          await supabase.from("team_chemie").update({ zusammen_count: existing.zusammen_count + 1, updated_at: new Date().toISOString() }).eq("id", existing.id);
        } else {
          await supabase.from("team_chemie").insert([{ mitarbeiter_a: a, mitarbeiter_b: b, zusammen_count: 1, priorisiert: false }]);
        }
      }
    }
    const { data: c } = await supabase.from("team_chemie").select("*").order("zusammen_count", { ascending: false });
    setChemie(c || []);
  }

  async function saveTeam(team: Team) {
    const p = {
      ...team,
      erstellt_von: currentUser?.name || "",
      datum: team.datum || datum,
      datum_bis: team.datum_bis || null,
      ist_dauerhaft: team.ist_dauerhaft || false,
      spezialisierung: team.spezialisierung || null,
    };
    if (team.id) {
      await supabase.from("teamplanung").update(p).eq("id", team.id);
      setTeams(ts => ts.map(t => t.id === team.id ? { ...p, id: team.id } : t));
    } else {
      const { data: neu } = await supabase.from("teamplanung").insert([p]).select();
      if (neu) setTeams(ts => [...ts, { ...p, id: neu[0].id }]);
    }
    await updateChemie(team.mitarbeiter);
    setEditTeam(null);
    setShowForm(false);
  }

  async function deleteTeam(id: number) {
    await supabase.from("teamplanung").delete().eq("id", id);
    setTeams(ts => ts.filter(t => t.id !== id));
  }

  async function togglePriorisiert(c: Chemie) {
    await supabase.from("team_chemie").update({ priorisiert: !c.priorisiert }).eq("id", c.id);
    setChemie(cs => cs.map(x => x.id === c.id ? { ...x, priorisiert: !x.priorisiert } : x));
  }

  // ── KI Auto-Zuweisung ────────────────────────────────────────────────────────
  async function kiAutoZuweisung() {
    setKiLoading(true);

    const aktiveMa = data.mitarbeiter.filter((m: any) =>
      m.status !== "krank" && m.status !== "Urlaub" && m.status !== "gekuendigt"
    );
    const aktiveBS = data.baustellen.filter((b: any) => b.status !== "abgeschlossen");

    const priorisierteChemie = chemie.filter(c => c.priorisiert).map(c => {
      const a = data.mitarbeiter.find((m: any) => m.id === c.mitarbeiter_a);
      const b = data.mitarbeiter.find((m: any) => m.id === c.mitarbeiter_b);
      return a && b ? { a: c.mitarbeiter_a, b: c.mitarbeiter_b, nameA: a.name, nameB: b.name } : null;
    }).filter(Boolean);

    const prompt = `Du bist ein Bau-Logistik-Experte. Erstelle einen optimalen Teamplan für den ${datum}.
Antworte NUR mit einem validen JSON Array. Kein Text davor oder danach.

MITARBEITER (verfügbar):
${JSON.stringify(aktiveMa.map((m: any) => ({ id: m.id, name: m.name, rolle: m.rolle, qualifikationen: m.qualifikationen || [], fuehrerschein: m.fuehrerschein || [], nichtMit: m.nichtMit || [] })))}

BAUSTELLEN (aktiv):
${JSON.stringify(aktiveBS.map((b: any) => ({ id: b.id, name: b.name, anforderungen: b.anforderungen || [] })))}

PRIORISIERTE PAARE (immer zusammen!):
${JSON.stringify(priorisierteChemie)}

REGELN:
- nichtMit Mitarbeiter NIEMALS zusammen
- Priorisierte Paare immer zusammen
- Teams von 2-4 Personen
- Qualifikationen mit Baustellen-Anforderungen abgleichen
- LKW-Fahrer können rotierend sein (rotierende array)

Antworte mit JSON Array in diesem Format (KEIN anderer Text!):
[
  {
    "team_name": "Team A",
    "farbe": "#4DB6AC",
    "spezialisierung": "Tiefbau",
    "mitarbeiter": [1, 3],
    "rotierende": [3],
    "baustellen": [1],
    "notizen": "LKW Fahrer rotiert"
  }
]`;

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1500,
          messages: [{ role: "user", content: prompt }]
        })
      });
      const d = await res.json();
      const text = d.content && d.content[0] && d.content[0].text;
      if (!text) throw new Error("Keine Antwort");

      // JSON aus Antwort extrahieren
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) throw new Error("Kein JSON gefunden");
      const kiTeams = JSON.parse(jsonMatch[0]);

      // Teams in Supabase speichern
      for (const t of kiTeams) {
        const team: Team = {
          datum,
          datum_bis: null,
          ist_dauerhaft: false,
          spezialisierung: t.spezialisierung || null,
          team_name: t.team_name,
          farbe: t.farbe || TEAM_FARBEN[0],
          mitarbeiter: (t.mitarbeiter || []).map(Number),
          rotierende: (t.rotierende || []).map(Number),
          baustellen: (t.baustellen || []).map(Number),
          notizen: t.notizen || "",
          erstellt_von: "KI",
        };
        const { data: neu } = await supabase.from("teamplanung").insert([team]).select();
        if (neu) {
          setTeams(ts => [...ts, { ...team, id: neu[0].id }]);
          await updateChemie(team.mitarbeiter);
        }
      }
    } catch (e: any) {
      alert("KI-Fehler: " + e.message);
    }
    setKiLoading(false);
  }

  const eingeplantIds = teams.flatMap(t => t.mitarbeiter);
  const nichtEingeplant = data.mitarbeiter.filter((m: any) =>
    !eingeplantIds.includes(m.id) && m.status !== "krank" && m.status !== "Urlaub" && m.status !== "gekuendigt"
  );
  const krank = data.mitarbeiter.filter((m: any) => m.status === "krank" || m.status === "Urlaub");

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <input type="date" value={datum} onChange={e => setDatum(e.target.value)}
            style={{ ...C.inp, marginBottom: 0, width: "auto", padding: "8px 12px" }} />
          <div style={{ fontSize: 12, color: "#888" }}>
            {teams.length} Teams · {eingeplantIds.length} eingeplant
          </div>
        </div>
        {kannPlanen && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button style={{ ...C.btnS }} onClick={() => setShowChemie(true)}>⚗ Chemie</button>
            <button
              style={{ ...C.btnS, opacity: kiLoading ? 0.7 : 1 }}
              onClick={kiAutoZuweisung}
              disabled={kiLoading}
            >
              {kiLoading ? "⏳ KI plant..." : "✦ KI-Zuweisung"}
            </button>
            <button style={{ ...C.btnP }} onClick={() => {
              setEditTeam({ datum, datum_bis: null, ist_dauerhaft: false, spezialisierung: "", team_name: "", farbe: TEAM_FARBEN[teams.length % TEAM_FARBEN.length], mitarbeiter: [], rotierende: [], baustellen: [], notizen: "", erstellt_von: "" });
              setShowForm(true);
            }}>+ Neues Team</button>
          </div>
        )}
      </div>

      {/* Krank/Urlaub Banner */}
      {krank.length > 0 && (
        <div style={{ ...C.card, marginBottom: 14, background: "#fff8e1", border: "1px solid #BA751733", padding: "10px 14px" }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#BA7517", marginBottom: 6 }}>🏥 Nicht verfügbar</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {krank.map((m: any) => (
              <div key={m.id} style={{ padding: "3px 10px", borderRadius: 8, background: "#fff3e0", border: "1px solid #BA751733", fontSize: 12, color: "#BA7517" }}>
                {m.name} · {m.status}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Teams Grid */}
      {loading ? (
        <div style={{ textAlign: "center", color: "#bbb", padding: 32 }}>Lädt...</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 14 }}>
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
              {kannPlanen && <div style={{ fontSize: 12 }}>Klicke "✦ KI-Zuweisung" für automatische Planung oder "+ Neues Team" für manuelle Planung</div>}
            </div>
          )}
        </div>
      )}

      {/* Nicht eingeplant */}
      {nichtEingeplant.length > 0 && (
        <div style={{ ...C.card, marginTop: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#E24B4A", marginBottom: 8 }}>⚠ Nicht eingeplant ({nichtEingeplant.length})</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {nichtEingeplant.map((m: any) => (
              <div key={m.id} style={{ padding: "4px 10px", borderRadius: 8, background: "#fff3f3", border: "1px solid #E24B4A33", fontSize: 12, color: "#E24B4A" }}>
                {m.name} · {m.rolle}
              </div>
            ))}
          </div>
        </div>
      )}

      {showForm && editTeam && (
        <TeamFormular team={editTeam} data={data} chemie={chemie} onSave={saveTeam} onClose={() => { setShowForm(false); setEditTeam(null); }} />
      )}
      {showChemie && (
        <ChemieModal chemie={chemie} data={data} onToggle={togglePriorisiert} onClose={() => setShowChemie(false)} />
      )}
    </div>
  );
}

// ── Team Karte ─────────────────────────────────────────────────────────────────
function TeamKarte({ team, data, kannPlanen, onEdit, onDelete }: any) {
  const getMa = (id: number) => data.mitarbeiter.find((m: any) => m.id === id);
  const getBS = (id: number) => data.baustellen.find((b: any) => b.id === id);

  return (
    <div style={{ ...C.card, borderTop: "4px solid " + team.farbe, padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: "#222" }}>{team.team_name}</span>
            {team.ist_dauerhaft && <span style={{ fontSize: 10, background: "#e8f5f3", color: ACCENT, borderRadius: 6, padding: "1px 6px", fontWeight: 600 }}>STAMM</span>}
            {team.erstellt_von === "KI" && <span style={{ fontSize: 10, background: "#f3e5f5", color: "#9C27B0", borderRadius: 6, padding: "1px 6px", fontWeight: 600 }}>✦ KI</span>}
          </div>
          {team.spezialisierung && <div style={{ fontSize: 11, color: ACCENT, marginTop: 2 }}>⚡ {team.spezialisierung}</div>}
          {team.ist_dauerhaft && team.datum_bis && <div style={{ fontSize: 10, color: "#bbb", marginTop: 2 }}>{team.datum} – {team.datum_bis}</div>}
        </div>
        {kannPlanen && (
          <div style={{ display: "flex", gap: 5 }}>
            <button onClick={onEdit} style={{ padding: "4px 8px", borderRadius: 7, border: "1px solid #eee", background: "#fff", cursor: "pointer", fontSize: 11, color: "#555" }}>✎</button>
            <button onClick={onDelete} style={{ padding: "4px 8px", borderRadius: 7, border: "none", background: "#E24B4A18", cursor: "pointer", fontSize: 11, color: "#E24B4A" }}>✕</button>
          </div>
        )}
      </div>

      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: "#aaa", marginBottom: 5, textTransform: "uppercase" as any }}>Mitarbeiter</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {team.mitarbeiter.map((id: number) => {
            const m = getMa(id);
            if (!m) return null;
            const isRot = team.rotierende.includes(id);
            return (
              <div key={id} style={{ display: "flex", alignItems: "center", gap: 3, padding: "4px 8px", borderRadius: 8, background: isRot ? "#fff3e0" : "#e8f5f3", border: "1px solid " + (isRot ? "#BA751722" : team.farbe + "33") }}>
                <span style={{ fontSize: 12, fontWeight: 500, color: isRot ? "#BA7517" : ACCENT }}>{m.name}</span>
                {isRot && <span title="Rotierend" style={{ fontSize: 10 }}>↻</span>}
              </div>
            );
          })}
          {team.mitarbeiter.length === 0 && <span style={{ fontSize: 12, color: "#bbb" }}>Keine</span>}
        </div>
      </div>

      <div style={{ marginBottom: team.notizen ? 10 : 0 }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: "#aaa", marginBottom: 5, textTransform: "uppercase" as any }}>Baustellen</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {team.baustellen.map((id: number) => {
            const b = getBS(id);
            if (!b) return null;
            return <div key={id} style={{ padding: "4px 8px", borderRadius: 8, background: "#f0f4f3", fontSize: 12, color: "#444" }}>⛏ {b.name}</div>;
          })}
          {team.baustellen.length === 0 && <span style={{ fontSize: 12, color: "#bbb" }}>Keine</span>}
        </div>
      </div>

      {team.notizen && <div style={{ marginTop: 8, padding: "7px 10px", background: "#f8f8f8", borderRadius: 8, fontSize: 11, color: "#666", fontStyle: "italic" }}>{team.notizen}</div>}
    </div>
  );
}

// ── Team Formular ──────────────────────────────────────────────────────────────
function TeamFormular({ team, data, chemie, onSave, onClose }: any) {
  const [f, setF] = useState<Team>({ ...team });
  const isMobile = window.innerWidth < 768;

  const toggleMA = (id: number) => setF(t => ({
    ...t,
    mitarbeiter: t.mitarbeiter.includes(id) ? t.mitarbeiter.filter(i => i !== id) : [...t.mitarbeiter, id],
    rotierende: t.mitarbeiter.includes(id) ? t.rotierende.filter(i => i !== id) : t.rotierende,
  }));
  const toggleRot = (id: number) => {
    if (!f.mitarbeiter.includes(id)) return;
    setF(t => ({ ...t, rotierende: t.rotierende.includes(id) ? t.rotierende.filter(i => i !== id) : [...t.rotierende, id] }));
  };
  const toggleBS = (id: number) => setF(t => ({
    ...t,
    baustellen: t.baustellen.includes(id) ? t.baustellen.filter(i => i !== id) : [...t.baustellen, id],
  }));

  const aktiveMa = data.mitarbeiter.filter((m: any) => m.status !== "krank" && m.status !== "Urlaub" && m.status !== "gekuendigt");
  const aktiveBS = data.baustellen.filter((b: any) => b.status !== "abgeschlossen");
  const getMaName = (id: number) => data.mitarbeiter.find((m: any) => m.id === id)?.name || "";

  const chemieHinweise = chemie.filter((c: any) =>
    (f.mitarbeiter.includes(c.mitarbeiter_a) || f.mitarbeiter.includes(c.mitarbeiter_b)) &&
    (c.priorisiert || c.zusammen_count >= 3)
  );

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: isMobile ? "flex-end" : "center", justifyContent: "center", zIndex: 9999 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ ...C.card, width: isMobile ? "100%" : "min(620px,95vw)", maxHeight: isMobile ? "92vh" : "90vh", overflowY: "auto", borderRadius: isMobile ? "20px 20px 0 0" : 16, padding: isMobile ? "20px 16px 32px" : 24, margin: 0 }}>

        {isMobile && <div style={{ width: 40, height: 4, background: "#ddd", borderRadius: 2, margin: "0 auto 16px" }} />}

        <div style={{ fontSize: 17, fontWeight: 700, color: "#222", marginBottom: 20, paddingBottom: 12, borderBottom: "1px solid #f5f5f5" }}>
          {team.id ? "Team bearbeiten" : "Neues Team"}
        </div>

        {/* Name + Farbe */}
        <div style={{ display: "flex", gap: 10, marginBottom: 14, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 160 }}>
            <label style={C.lbl}>Team Name</label>
            <input style={C.inp} value={f.team_name} onChange={e => setF(t => ({ ...t, team_name: e.target.value }))} placeholder="z.B. Team Rot" />
          </div>
          <div>
            <label style={C.lbl}>Farbe</label>
            <div style={{ display: "flex", gap: 5, marginBottom: 8 }}>
              {TEAM_FARBEN.map(c => (
                <button key={c} onClick={() => setF(t => ({ ...t, farbe: c }))}
                  style={{ width: 26, height: 26, borderRadius: "50%", background: c, border: f.farbe === c ? "3px solid #222" : "2px solid transparent", cursor: "pointer" }} />
              ))}
            </div>
          </div>
        </div>

        {/* Spezialisierung */}
        <div style={{ marginBottom: 14 }}>
          <label style={C.lbl}>Spezialisierung</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {SPEZIALISIERUNGEN.map(s => (
              <button key={s} onClick={() => setF(t => ({ ...t, spezialisierung: t.spezialisierung === s ? "" : s }))}
                style={{ padding: "5px 12px", borderRadius: 16, border: "1.5px solid " + (f.spezialisierung === s ? ACCENT : "#e8eaed"), background: f.spezialisierung === s ? "#e8f5f3" : "#fff", color: f.spezialisierung === s ? ACCENT : "#888", cursor: "pointer", fontSize: 12, fontWeight: f.spezialisierung === s ? 600 : 400 }}>
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Dauerhaft */}
        <div style={{ marginBottom: 14, padding: "12px 14px", background: "#f8f8ff", borderRadius: 10, border: "1px solid #e8eaed" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: f.ist_dauerhaft ? 10 : 0 }}>
            <input type="checkbox" id="dauerhaft" checked={f.ist_dauerhaft} onChange={e => setF(t => ({ ...t, ist_dauerhaft: e.target.checked }))}
              style={{ width: 16, height: 16, accentColor: ACCENT, cursor: "pointer" }} />
            <label htmlFor="dauerhaft" style={{ fontSize: 13, fontWeight: 600, color: "#333", cursor: "pointer" }}>Stamm-Team (dauerhaft für Zeitraum)</label>
          </div>
          {f.ist_dauerhaft && (
            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ flex: 1 }}>
                <label style={C.lbl}>Von</label>
                <input type="date" style={C.inp} value={f.datum} onChange={e => setF(t => ({ ...t, datum: e.target.value }))} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={C.lbl}>Bis</label>
                <input type="date" style={C.inp} value={f.datum_bis || ""} onChange={e => setF(t => ({ ...t, datum_bis: e.target.value }))} />
              </div>
            </div>
          )}
        </div>

        {/* Chemie Hinweise */}
        {chemieHinweise.length > 0 && (
          <div style={{ marginBottom: 14, padding: "10px 12px", background: "#fff8e1", borderRadius: 10, border: "1px solid #BA751733" }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#BA7517", marginBottom: 6 }}>⚗ Team-Chemie</div>
            {chemieHinweise.map((c: any) => (
              <div key={c.id} style={{ fontSize: 11, color: "#666", marginBottom: 2 }}>
                {c.priorisiert ? "⭐" : "↻"} {getMaName(c.mitarbeiter_a)} + {getMaName(c.mitarbeiter_b)} – {c.zusammen_count}× zusammen
              </div>
            ))}
          </div>
        )}

        {/* Mitarbeiter */}
        <div style={{ marginBottom: 14 }}>
          <label style={C.lbl}>Mitarbeiter ({f.mitarbeiter.length} ausgewählt)</label>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 220, overflowY: "auto", border: "1px solid #e8eaed", borderRadius: 10, padding: 8 }}>
            {aktiveMa.map((m: any) => {
              const sel = f.mitarbeiter.includes(m.id);
              const isRot = f.rotierende.includes(m.id);
              const chemieP = chemie.filter((c: any) =>
                (c.mitarbeiter_a === m.id || c.mitarbeiter_b === m.id) && c.priorisiert
              ).map((c: any) => getMaName(c.mitarbeiter_a === m.id ? c.mitarbeiter_b : c.mitarbeiter_a));
              return (
                <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: 8, background: sel ? "#e8f5f3" : "#fff", border: "1px solid " + (sel ? ACCENT + "44" : "#eee") }}>
                  <input type="checkbox" checked={sel} onChange={() => toggleMA(m.id)} style={{ width: 16, height: 16, accentColor: ACCENT, cursor: "pointer" }} />
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: 13, fontWeight: sel ? 600 : 400, color: sel ? ACCENT : "#333" }}>{m.name}</span>
                    <span style={{ fontSize: 11, color: "#aaa", marginLeft: 6 }}>{m.rolle}</span>
                    {chemieP.length > 0 && <span style={{ fontSize: 10, color: "#BA7517", marginLeft: 6 }}>⭐ bevorzugt mit {chemieP.join(", ")}</span>}
                  </div>
                  {sel && (
                    <button onClick={() => toggleRot(m.id)}
                      style={{ padding: "2px 8px", borderRadius: 6, border: "1px solid " + (isRot ? "#BA7517" : "#eee"), background: isRot ? "#fff3e0" : "#fff", cursor: "pointer", fontSize: 11, color: isRot ? "#BA7517" : "#bbb", whiteSpace: "nowrap" }}>
                      {isRot ? "↻ Rotierend" : "Rotierend?"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Baustellen */}
        <div style={{ marginBottom: 14 }}>
          <label style={C.lbl}>Baustellen ({f.baustellen.length} ausgewählt)</label>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 160, overflowY: "auto", border: "1px solid #e8eaed", borderRadius: 10, padding: 8 }}>
            {aktiveBS.map((b: any) => {
              const sel = f.baustellen.includes(b.id);
              return (
                <div key={b.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: 8, background: sel ? "#e8f5f3" : "#fff", border: "1px solid " + (sel ? ACCENT + "44" : "#eee") }}>
                  <input type="checkbox" checked={sel} onChange={() => toggleBS(b.id)} style={{ width: 16, height: 16, accentColor: ACCENT, cursor: "pointer" }} />
                  <span style={{ fontSize: 13, fontWeight: sel ? 600 : 400, color: sel ? ACCENT : "#333" }}>⛏ {b.name}</span>
                  {b.ort && <span style={{ fontSize: 11, color: "#aaa" }}>{b.ort}</span>}
                </div>
              );
            })}
          </div>
        </div>

        {/* Notizen */}
        <div style={{ marginBottom: 20 }}>
          <label style={C.lbl}>Notizen</label>
          <input style={C.inp} value={f.notizen} onChange={e => setF(t => ({ ...t, notizen: e.target.value }))} placeholder="z.B. LKW-Fahrer rotiert zwischen Baustelle A und B" />
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button style={{ ...C.btnS, flex: 1 }} onClick={onClose}>Abbrechen</button>
          <button style={{ ...C.btnP, flex: 1, opacity: !f.team_name ? 0.5 : 1 }} onClick={() => { if (f.team_name) onSave(f); }}>Speichern</button>
        </div>
      </div>
    </div>
  );
}

// ── Chemie Modal ───────────────────────────────────────────────────────────────
function ChemieModal({ chemie, data, onToggle, onClose }: any) {
  const isMobile = window.innerWidth < 768;
  const getMaName = (id: number) => data.mitarbeiter.find((m: any) => m.id === id)?.name || "?";
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: isMobile ? "flex-end" : "center", justifyContent: "center", zIndex: 9999 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ ...C.card, width: isMobile ? "100%" : "min(500px,95vw)", maxHeight: isMobile ? "85vh" : "80vh", overflowY: "auto", borderRadius: isMobile ? "20px 20px 0 0" : 16, padding: isMobile ? "20px 16px 32px" : 24, margin: 0 }}>
        {isMobile && <div style={{ width: 40, height: 4, background: "#ddd", borderRadius: 2, margin: "0 auto 16px" }} />}
        <div style={{ fontSize: 17, fontWeight: 700, color: "#222", marginBottom: 6 }}>⚗ Team-Chemie</div>
        <div style={{ fontSize: 12, color: "#aaa", marginBottom: 16 }}>Wird automatisch gespeichert wenn Teams eingeplant werden. Priorisierte Paare werden bei KI-Zuweisung bevorzugt.</div>
        {chemie.length === 0 && <div style={{ textAlign: "center", color: "#bbb", padding: 24, fontSize: 13 }}>Noch keine Daten – erstelle Teams um Chemie aufzubauen!</div>}
        {chemie.map((c: any) => (
          <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 10, border: "1px solid " + (c.priorisiert ? "#BA751733" : "#eee"), background: c.priorisiert ? "#fff8e1" : "#fff", marginBottom: 6 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{getMaName(c.mitarbeiter_a)} + {getMaName(c.mitarbeiter_b)}</div>
              <div style={{ fontSize: 11, color: "#aaa" }}>{c.zusammen_count}× zusammen gearbeitet</div>
            </div>
            <button onClick={() => onToggle(c)}
              style={{ padding: "4px 10px", borderRadius: 8, border: "1.5px solid " + (c.priorisiert ? "#BA7517" : "#eee"), background: c.priorisiert ? "#fff3e0" : "#fff", cursor: "pointer", fontSize: 12, color: c.priorisiert ? "#BA7517" : "#aaa", fontWeight: c.priorisiert ? 600 : 400 }}>
              {c.priorisiert ? "⭐ Priorisiert" : "Priorisieren"}
            </button>
          </div>
        ))}
        <button style={{ ...C.btnS, width: "100%", marginTop: 12 }} onClick={onClose}>Schließen</button>
      </div>
    </div>
  );
}
