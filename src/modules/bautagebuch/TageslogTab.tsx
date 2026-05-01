import { useState } from "react";
import { C, ACCENT } from "../../lib/constants";
import { supabase } from "../../lib/supabase";

const WETTER_DE: Record<string, string> = {
  "Sunny": "Sonnig", "Clear": "Klar", "Partly cloudy": "Teilweise bewölkt",
  "Cloudy": "Bewölkt", "Overcast": "Bedeckt", "Mist": "Neblig",
  "Patchy rain possible": "Leichter Regen möglich", "Fog": "Nebel",
  "Light rain": "Leichter Regen", "Moderate rain": "Mäßiger Regen",
  "Heavy rain": "Starker Regen", "Light snow": "Leichter Schnee",
  "Moderate snow": "Mäßiger Schnee", "Heavy snow": "Starker Schnee",
  "Thunder": "Gewitter", "Thunderstorm": "Gewitter",
};
function wetterDE(en: string) { return WETTER_DE[en] || en; }

export function TageslogTab({ eintrag, setEintrag, data, currentUser, isMobile }: any) {
  const [wetterLoad, setWetterLoad] = useState(false);
  const [saved,      setSaved]      = useState(false);

  async function saveEintrag() {
    if (!eintrag) return;
    const p = { ...eintrag, erstellt_von: currentUser?.name || "" };
    if (eintrag.id) {
      await supabase.from("bautagebuch_eintraege").update(p).eq("id", eintrag.id);
    } else {
      const { data: neu } = await supabase.from("bautagebuch_eintraege").insert([p]).select().single();
      if (neu) setEintrag({ ...p, id: neu.id });
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function wetterLaden() {
    if (!eintrag) return;
    setWetterLoad(true);
    const bs = data.baustellen.find((b: any) => b.id === eintrag.baustelle_id);
    const ort = bs?.ort || "Dresden";
    try {
      const res = await fetch(`https://wttr.in/${encodeURIComponent(ort)}?format=j1`);
      const d = await res.json();
      const w = d.current_condition?.[0];
      if (w) {
        setEintrag((e: any) => ({
          ...e,
          temperatur:   w.temp_C + "°C",
          wetter:       wetterDE(w.weatherDesc?.[0]?.value || ""),
          wind:         w.windspeedKmph + " km/h",
          niederschlag: w.precipMM + " mm",
        }));
      }
    } catch { /* ignorieren */ }
    setWetterLoad(false);
  }

  const toggleMA = (id: number) => setEintrag((e: any) => ({
    ...e,
    mitarbeiter_anwesend: e.mitarbeiter_anwesend.includes(id)
      ? e.mitarbeiter_anwesend.filter((i: number) => i !== id)
      : [...e.mitarbeiter_anwesend, id],
  }));

  const toggleFZ = (id: number) => setEintrag((e: any) => ({
    ...e,
    geraete: (e.geraete || []).includes(id)
      ? e.geraete.filter((i: number) => i !== id)
      : [...(e.geraete || []), id],
  }));

  if (!eintrag) return <div style={{ textAlign: "center", color: "#bbb", padding: 32 }}>Lädt...</div>;

  // Fahrzeuge die dieser Baustelle zugewiesen sind
  const bs = data.baustellen.find((b: any) => b.id === eintrag.baustelle_id);
  const bsFzIds = (bs?.fahrzeuge || []).map((id: any) => Number(id)).filter((id: number) => !isNaN(id));
  const bsFahrzeuge = bsFzIds.map((id: number) => data.fahrzeuge.find((f: any) => f.id === id)).filter(Boolean);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

      {/* Wetter */}
      <div style={{ ...C.card, padding: "14px 16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#222" }}>🌤 Wetterdaten</span>
          <button onClick={wetterLaden} disabled={wetterLoad} style={{ ...C.btnS, fontSize: 11, padding: "5px 12px", opacity: wetterLoad ? 0.6 : 1 }}>
            {wetterLoad ? "Lädt..." : "⟳ Auto-laden"}
          </button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr 1fr 1fr", gap: 10 }}>
          {[["Wetter", "wetter", "Bewölkt"], ["Temperatur", "temperatur", "18°C"], ["Wind", "wind", "15 km/h"], ["Niederschlag", "niederschlag", "0 mm"]].map(([label, key, ph]) => (
            <div key={key}>
              <label style={C.lbl}>{label}</label>
              <input style={C.inp} value={(eintrag as any)[key] || ""} placeholder={ph}
                onChange={e => setEintrag((x: any) => ({ ...x, [key]: e.target.value }))} />
            </div>
          ))}
        </div>
      </div>

      {/* Arbeitszeiten */}
      <div style={{ ...C.card, padding: "14px 16px" }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#222", marginBottom: 12 }}>⏰ Arbeitszeiten</div>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10 }}>
          <div>
            <label style={C.lbl}>Arbeitsbeginn</label>
            <input type="time" style={C.inp} value={eintrag.arbeitsbeginn || ""}
              onChange={e => setEintrag((x: any) => ({ ...x, arbeitsbeginn: e.target.value }))} />
          </div>
          <div>
            <label style={C.lbl}>Arbeitsende</label>
            <input type="time" style={C.inp} value={eintrag.arbeitsende || ""}
              onChange={e => setEintrag((x: any) => ({ ...x, arbeitsende: e.target.value }))} />
          </div>
        </div>
      </div>

      {/* Mitarbeiter */}
      <div style={{ ...C.card, padding: "14px 16px" }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#222", marginBottom: 10 }}>
          👷 Anwesend ({eintrag.mitarbeiter_anwesend.length})
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {data.mitarbeiter
            .filter((m: any) => m.status !== "krank" && m.status !== "Urlaub" && m.status !== "gekuendigt")
            .map((m: any) => {
              const sel = eintrag.mitarbeiter_anwesend.includes(m.id);
              return (
                <button key={m.id} onClick={() => toggleMA(m.id)}
                  style={{ padding: "7px 12px", borderRadius: 10, border: "1.5px solid " + (sel ? ACCENT : "#eee"), background: sel ? "#e8f5f3" : "#fff", cursor: "pointer", fontSize: 12, color: sel ? ACCENT : "#555", fontWeight: sel ? 600 : 400 }}>
                  {m.name}
                </button>
              );
            })}
        </div>
      </div>

      {/* Fahrzeuge */}
      {bsFahrzeuge.length > 0 && (
        <div style={{ ...C.card, padding: "14px 16px" }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#222", marginBottom: 10 }}>
            🚛 Fahrzeuge im Einsatz ({(eintrag.geraete || []).length})
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {bsFahrzeuge.map((f: any) => {
              const sel = (eintrag.geraete || []).includes(f.id);
              return (
                <button key={f.id} onClick={() => toggleFZ(f.id)}
                  style={{ padding: "7px 12px", borderRadius: 10, border: "1.5px solid " + (sel ? "#378ADD" : "#eee"), background: sel ? "#e8f0fb" : "#fff", cursor: "pointer", fontSize: 12, color: sel ? "#378ADD" : "#555", fontWeight: sel ? 600 : 400 }}>
                  {f.name}
                  {f.kennzeichen && <span style={{ fontSize: 10, color: sel ? "#378ADD99" : "#bbb", marginLeft: 5 }}>{f.kennzeichen}</span>}
                </button>
              );
            })}
          </div>
          {bsFahrzeuge.length === 0 && (
            <div style={{ fontSize: 11, color: "#bbb" }}>Keine Fahrzeuge dieser Baustelle zugewiesen</div>
          )}
        </div>
      )}

      {/* Notizen */}
      <div style={{ ...C.card, padding: "14px 16px" }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#222", marginBottom: 10 }}>📝 Notizen</div>
        <label style={C.lbl}>Tagesnotizen (auch von Sascha übertragen)</label>
        <textarea rows={4} style={{ ...C.inp, resize: "vertical" as any, fontFamily: "system-ui" }}
          value={eintrag.notizen || ""} placeholder="Was wurde heute gemacht..."
          onChange={e => setEintrag((x: any) => ({ ...x, notizen: e.target.value }))} />
        <label style={C.lbl}>Besonderheiten / Abweichungen</label>
        <textarea rows={2} style={{ ...C.inp, resize: "vertical" as any, fontFamily: "system-ui", borderColor: eintrag.besonderheiten ? "#BA7517" : "#e8eaed" }}
          value={eintrag.besonderheiten || ""} placeholder="z.B. Mehrverbrauch, Schäden..."
          onChange={e => setEintrag((x: any) => ({ ...x, besonderheiten: e.target.value }))} />
      </div>

      <button onClick={saveEintrag}
        style={{ ...C.btnP, width: "100%", padding: "13px", fontSize: 14, background: saved ? "#1D9E75" : ACCENT }}>
        {saved ? "✓ Gespeichert!" : "Tageslog speichern"}
      </button>
    </div>
  );
}
