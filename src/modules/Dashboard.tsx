import { useState, useEffect, useRef } from "react";
import { C, ACCENT } from "../lib/constants";
import { getProgress } from "../lib/utils";
import { Kalender } from "../components/Kalender";

declare const L: any;

const HAUPTQUARTIER = { lat: 51.137514, lng: 13.782102 };

const STATUS_FARBEN: Record<string, string> = {
  laufend:       "#4DB6AC",
  geplant:       "#7986CB",
  abgeschlossen: "#888",
};

export function Dashboard({ data, setTab, saveTermin, deleteTermin, setSelectedBS, isMobile }: any) {
  const [aiRes, setAiRes]   = useState("");
  const [aiLoad, setAiLoad] = useState(false);
  const [frage, setFrage]   = useState("");

  const bsColors = ["#b2dfdb","#80cbc4","#4DB6AC","#26a69a","#00897b"];
  const today = new Date().toISOString().split("T")[0];
  const heuteTermine = (data.termine || []).filter((t: any) => t.datum === today);

  const sorted = data.baustellen
    .filter((b: any) => b.status !== "abgeschlossen")
    .sort((a: any, b: any) => {
      const da = a.ende ? new Date(a.ende).getTime() : Infinity;
      const db = b.ende ? new Date(b.ende).getTime() : Infinity;
      return da - db;
    });

  const getDL = (ende: string) => {
    if (!ende) return null;
    const dl = Math.ceil((new Date(ende).getTime() - Date.now()) / 86400000);
    return isNaN(dl) ? null : dl;
  };

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

  // ── MOBILE LAYOUT ─────────────────────────────────────────────────────────────
  if (isMobile) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

        {heuteTermine.length > 0 && (
          <div style={{ ...C.card, padding: "12px 14px" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#222", marginBottom: 8 }}>📅 Heute</div>
            {heuteTermine.map((t: any) => (
              <div key={t.id} style={{ display: "flex", gap: 8, padding: "5px 0", borderBottom: "1px solid #f5f5f5", alignItems: "center" }}>
                <div style={{ width: 3, minHeight: 24, borderRadius: 2, background: t.art === "Pflichttermin" ? "#E24B4A" : ACCENT, flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#222" }}>{t.titel}</div>
                  <div style={{ fontSize: 10, color: "#aaa" }}>{t.uhrzeit} – {t.art}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Aktive Baustellen */}
        <div style={{ ...C.card, padding: "12px 14px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#222" }}>Aktive Baustellen</span>
            <button onClick={() => setTab(3)} style={{ fontSize: 11, color: ACCENT, background: "none", border: "none", cursor: "pointer", fontWeight: 500 }}>Alle →</button>
          </div>
          {sorted.length === 0 && <div style={{ fontSize: 12, color: "#bbb", textAlign: "center", padding: 8 }}>Keine aktiven Baustellen</div>}
          {sorted.map((b: any, idx: number) => {
            const col = bsColors[idx % bsColors.length];
            const prog = getProgress(b);
            const auf = b.aufgaben || [];
            const done = auf.filter((a: any) => a.erledigt).length;
            const dl = getDL(b.ende);
            return (
              <div key={b.id} onClick={() => { setSelectedBS(b.id); setTab(3); }}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: "1px solid #f5f5f5", cursor: "pointer" }}>
                <div style={{ width: 4, height: 40, borderRadius: 2, background: col, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#222", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{b.name}</div>
                  <div style={{ fontSize: 10, color: "#888", marginBottom: 4 }}>{b.ort}</div>
                  <div style={{ height: 4, background: "#eee", borderRadius: 2 }}>
                    <div style={{ height: "100%", width: prog + "%", background: col, borderRadius: 2 }} />
                  </div>
                  {auf.length > 0 && <div style={{ fontSize: 9, color: "#bbb", marginTop: 3 }}>{done}/{auf.length} Aufgaben ✓</div>}
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: ACCENT }}>{prog}%</div>
                  {dl !== null && <div style={{ fontSize: 10, color: dl <= 14 ? "#E24B4A" : "#bbb" }}>{dl}d</div>}
                </div>
              </div>
            );
          })}
        </div>

        {/* Kalender */}
        <div style={{ ...C.card, padding: "12px 14px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#222" }}>Kalender</span>
            <button onClick={() => setTab(4)} style={{ fontSize: 11, color: ACCENT, background: "none", border: "none", cursor: "pointer", fontWeight: 500 }}>Vollansicht</button>
          </div>
          <Kalender termine={data.termine || []} onSave={saveTermin} onDelete={deleteTermin} compact={true} baustellen={data.baustellen} />
        </div>

        {/* Mini Karte auf Mobile */}
        <div style={{ ...C.card, padding: "12px 14px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#222" }}>🗺 Karte</span>
            <button onClick={() => setTab(11)} style={{ fontSize: 11, color: ACCENT, background: "none", border: "none", cursor: "pointer", fontWeight: 500 }}>Vollansicht →</button>
          </div>
          <MiniKarte data={data} setTab={setTab} setSelectedBS={setSelectedBS} hoehe={200} />
        </div>

        {/* KI Hilfe */}
        <div style={{ ...C.card, padding: "12px 14px" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#222", marginBottom: 8 }}>✦ KI Hilfe</div>
          <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
            {[["Auslastung", "Kurze Zusammenfassung der aktuellen Auslastung."], ["Engpässe", "Kritische Engpaesse?"], ["Heute", "Was sollte ich heute zuerst tun?"]].map(q => (
              <button key={q[0]} onClick={() => ask(q[1])} style={{ padding: "6px 14px", borderRadius: 16, background: "#f0faf9", border: "1px solid " + ACCENT + "44", color: ACCENT, cursor: "pointer", fontSize: 12, fontWeight: 500 }}>{q[0]}</button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
            <input style={{ ...C.inp, marginBottom: 0, flex: 1, fontSize: 13, padding: "10px 12px" }} value={frage} onChange={e => setFrage(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && frage) ask(frage); }} placeholder="Frage stellen..." />
            <button onClick={() => { if (frage) ask(frage); }} style={{ padding: "10px 16px", borderRadius: 10, border: "none", background: ACCENT, cursor: "pointer", fontSize: 14, color: "#fff", fontWeight: 600, flexShrink: 0 }}>→</button>
          </div>
          {(aiLoad || aiRes) && (
            <div style={{ background: "#f8fffe", borderRadius: 8, padding: "10px 12px", fontSize: 12, lineHeight: 1.6, color: aiLoad ? "#bbb" : "#444", whiteSpace: "pre-wrap", border: "1px solid #e8f5f3" }}>
              {aiLoad ? "KI analysiert..." : aiRes}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── DESKTOP LAYOUT ────────────────────────────────────────────────────────────
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 12, height: "100%", overflow: "hidden" }}>

      {/* Linke Spalte */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12, height: "100%", overflow: "hidden" }}>

        {/* Aktive Baustellen */}
        <div style={{ ...C.card, display: "flex", flexDirection: "column", flex: "0 0 auto", maxHeight: "45%" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexShrink: 0 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#222" }}>Aktive Baustellen</span>
            <button onClick={() => setTab(3)} style={{ fontSize: 11, color: ACCENT, background: "none", border: "none", cursor: "pointer", fontWeight: 500 }}>Alle anzeigen →</button>
          </div>
          <div style={{ overflowY: "auto", flex: 1, minHeight: 0 }}>
            {sorted.map((b: any, idx: number) => {
              const col = bsColors[idx % bsColors.length];
              const prog = getProgress(b);
              const auf = b.aufgaben || [];
              const done = auf.filter((a: any) => a.erledigt).length;
              const dl = getDL(b.ende);
              return (
                <div key={b.id} onClick={() => { setSelectedBS(b.id); setTab(3); }}
                  style={{ background: col + "28", borderRadius: 8, padding: "6px 10px", marginBottom: 5, border: "1.5px solid " + col, cursor: "pointer", transition: "transform 0.12s" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ""; }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                    <div>
                      <span style={{ fontWeight: 600, fontSize: 12, color: "#222" }}>{b.name}</span>
                      {b.ort && <span style={{ fontSize: 10, color: "#888", marginLeft: 6 }}>{b.ort}</span>}
                    </div>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: ACCENT }}>{prog}%</span>
                      {dl !== null && <span style={{ fontSize: 9, color: dl <= 14 ? "#E24B4A" : "#bbb" }}>{dl}d</span>}
                    </div>
                  </div>
                  <div style={{ height: 3, background: "rgba(0,0,0,0.08)", borderRadius: 2, marginBottom: 4 }}>
                    <div style={{ height: "100%", width: prog + "%", background: ACCENT, borderRadius: 2 }} />
                  </div>
                  {auf.length > 0 ? (
                    <div style={{ display: "flex", gap: 3, flexWrap: "wrap", alignItems: "center" }}>
                      {auf.slice(0, 3).map((a: any) => <span key={a.id} style={{ fontSize: 9, padding: "1px 5px", borderRadius: 6, background: a.erledigt ? ACCENT + "22" : "#f0f0f0", color: a.erledigt ? ACCENT : "#aaa", textDecoration: a.erledigt ? "line-through" : "none" }}>{a.titel}</span>)}
                      {auf.length > 3 && <span style={{ fontSize: 9, color: "#bbb" }}>+{auf.length - 3}</span>}
                      <span style={{ fontSize: 9, color: "#bbb", marginLeft: "auto" }}>{done}/{auf.length} ✓</span>
                    </div>
                  ) : <div style={{ fontSize: 9, color: "#ccc", fontStyle: "italic" }}>Keine Aufgaben</div>}
                </div>
              );
            })}
          </div>
        </div>

        {/* Echte Karte statt SVG */}
        <div style={{ ...C.card, flex: 1, minHeight: 0, overflow: "hidden", padding: "14px 16px", display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexShrink: 0 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#222" }}>🗺 Baustellen-Übersicht</span>
            <button onClick={() => setTab(11)} style={{ fontSize: 11, color: ACCENT, background: "none", border: "none", cursor: "pointer", fontWeight: 500 }}>Vollansicht →</button>
          </div>
          <div style={{ flex: 1, minHeight: 0 }}>
            <MiniKarte data={data} setTab={setTab} setSelectedBS={setSelectedBS} hoehe={undefined} />
          </div>
        </div>
      </div>

      {/* Rechte Spalte */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12, height: "100%", overflow: "hidden" }}>

        {/* Kalender */}
        <div style={{ ...C.card, flexShrink: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#222" }}>Kalender</span>
            <button onClick={() => setTab(4)} style={{ fontSize: 11, color: ACCENT, background: "none", border: "none", cursor: "pointer", fontWeight: 500 }}>Vollansicht</button>
          </div>
          <Kalender termine={data.termine || []} onSave={saveTermin} onDelete={deleteTermin} compact={true} baustellen={data.baustellen} />
        </div>

        {/* Heute */}
        {heuteTermine.length > 0 && (
          <div style={{ ...C.card, flexShrink: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#222", marginBottom: 6 }}>📅 Heute</div>
            {heuteTermine.map((t: any) => (
              <div key={t.id} style={{ display: "flex", gap: 8, padding: "4px 0", borderBottom: "1px solid #f5f5f5", alignItems: "center" }}>
                <div style={{ width: 3, minHeight: 22, borderRadius: 2, background: t.art === "Pflichttermin" ? "#E24B4A" : ACCENT, flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#222" }}>{t.titel}</div>
                  <div style={{ fontSize: 10, color: "#aaa" }}>{t.uhrzeit} – {t.art}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* KI Hilfe */}
        <div style={{ ...C.card, flexShrink: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#222", marginBottom: 7 }}>✦ KI Hilfe</div>
          <div style={{ display: "flex", gap: 4, marginBottom: 6, flexWrap: "wrap" }}>
            {[["Auslastung", "Kurze Zusammenfassung der aktuellen Auslastung."], ["Engpässe", "Kritische Engpaesse?"], ["Heute", "Was sollte ich heute zuerst tun?"]].map(q => (
              <button key={q[0]} onClick={() => ask(q[1])} style={{ padding: "3px 8px", borderRadius: 12, background: "#f0faf9", border: "1px solid " + ACCENT + "44", color: ACCENT, cursor: "pointer", fontSize: 10, fontWeight: 500 }}>{q[0]}</button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 5, marginBottom: 6 }}>
            <input style={{ ...C.inp, marginBottom: 0, flex: 1, fontSize: 11, padding: "5px 8px" }} value={frage} onChange={e => setFrage(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && frage) ask(frage); }} placeholder="Frage stellen..." />
            <button onClick={() => { if (frage) ask(frage); }} style={{ padding: "5px 10px", borderRadius: 8, border: "none", background: ACCENT, cursor: "pointer", fontSize: 12, color: "#fff", fontWeight: 600, flexShrink: 0 }}>→</button>
          </div>
          <div style={{ background: "#f8fffe", borderRadius: 8, padding: "7px 10px", minHeight: 40, fontSize: 11, lineHeight: 1.5, color: aiLoad ? "#bbb" : "#444", whiteSpace: "pre-wrap", border: "1px solid #e8f5f3" }}>
            {aiLoad ? "KI analysiert..." : aiRes || "Stelle eine Frage."}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Mini Karte Komponente ──────────────────────────────────────────────────────
function MiniKarte({ data, setTab, setSelectedBS, hoehe }: any) {
  const mapRef     = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Leaflet laden
  useEffect(() => {
    if (document.getElementById("leaflet-css")) { setLoaded(true); return; }
    const css = document.createElement("link");
    css.id = "leaflet-css";
    css.rel = "stylesheet";
    css.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(css);
    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.onload = () => setLoaded(true);
    document.head.appendChild(script);
  }, []);

  // Karte initialisieren
  useEffect(() => {
    if (!loaded || !mapRef.current || leafletMap.current) return;
    leafletMap.current = L.map(mapRef.current, {
      center: [HAUPTQUARTIER.lat, HAUPTQUARTIER.lng],
      zoom: 11,
      zoomControl: false,
      attributionControl: false,
      dragging: true,
      scrollWheelZoom: false,
    });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(leafletMap.current);
    return () => { if (leafletMap.current) { leafletMap.current.remove(); leafletMap.current = null; } };
  }, [loaded]);

  // Marker setzen
  useEffect(() => {
    if (!loaded || !leafletMap.current) return;
    const map = leafletMap.current;

    // Alte Marker entfernen
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    // Hauptquartier
    const hqIcon = L.divIcon({
      className: "",
      html: `<div style="width:32px;height:32px;border-radius:50%;background:#222;border:2px solid ${ACCENT};display:flex;align-items:center;justify-content:center;font-size:14px;box-shadow:0 2px 8px rgba(0,0,0,0.3);">🏢</div>`,
      iconSize: [32, 32], iconAnchor: [16, 16],
    });
    const hqM = L.marker([HAUPTQUARTIER.lat, HAUPTQUARTIER.lng], { icon: hqIcon, zIndexOffset: 1000 })
      .addTo(map)
      .bindTooltip("🏢 Hauptquartier", { direction: "top" });
    markersRef.current.push(hqM);

    // Baustellen
    const bsMitKoords = data.baustellen.filter((b: any) => b.lat && b.lng);
    bsMitKoords.forEach((b: any) => {
      const farbe = STATUS_FARBEN[b.status] || "#888";
      const icon = L.divIcon({
        className: "",
        html: `<div style="width:28px;height:28px;border-radius:50% 50% 50% 0;background:${farbe};border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.3);transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;"><span style="transform:rotate(45deg);font-size:12px;">⛏</span></div>`,
        iconSize: [28, 28], iconAnchor: [14, 28],
      });
      const marker = L.marker([b.lat, b.lng], { icon })
        .addTo(map)
        .bindTooltip(`<b>${b.name}</b><br>${b.status}`, { direction: "top" })
        .on("click", () => { setSelectedBS(b.id); setTab(3); });
      markersRef.current.push(marker);
    });

    // Karte auf alle Punkte zentrieren
    const allePunkte = [
      [HAUPTQUARTIER.lat, HAUPTQUARTIER.lng],
      ...bsMitKoords.map((b: any) => [b.lat, b.lng]),
    ];
    if (allePunkte.length > 1) {
      const bounds = L.latLngBounds(allePunkte);
      if (bounds.isValid()) map.fitBounds(bounds, { padding: [20, 20] });
    }
  }, [loaded, data]);

  return (
    <div style={{ position: "relative", width: "100%", height: hoehe ? hoehe + "px" : "100%", borderRadius: 10, overflow: "hidden", border: "1px solid #eee" }}>
      <div ref={mapRef} style={{ width: "100%", height: "100%" }} />
      {!loaded && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "#f0f4f3" }}>
          <div style={{ textAlign: "center", color: "#bbb", fontSize: 12 }}>🗺 Karte lädt...</div>
        </div>
      )}
      {/* Vollansicht Button */}
      <button
        onClick={() => setTab(11)}
        style={{ position: "absolute", bottom: 8, right: 8, background: "rgba(255,255,255,0.9)", border: "none", borderRadius: 6, padding: "4px 8px", fontSize: 10, cursor: "pointer", color: "#555", zIndex: 1000, boxShadow: "0 1px 4px rgba(0,0,0,0.15)" }}>
        ⛶ Vollansicht
      </button>
    </div>
  );
}
