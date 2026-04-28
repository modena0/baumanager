import { useState, useEffect, useRef } from "react";
import { C, ACCENT } from "../lib/constants";
import { supabase } from "../lib/supabase";

// Leaflet wird über CDN geladen
declare const L: any;

const STATUS_FARBEN: Record<string, string> = {
  laufend:       "#4DB6AC",
  geplant:       "#7986CB",
  abgeschlossen: "#888",
};

const STATUS_ICONS: Record<string, string> = {
  laufend:       "🟢",
  geplant:       "🔵",
  abgeschlossen: "⚫",
};

interface GeoBS {
  id: number;
  name: string;
  ort: string;
  lat: number;
  lng: number;
  status: string;
  kategorie?: string;
  beschreibung?: string;
  start?: string;
  ende?: string;
  mitarbeiter: number[];
  fahrzeuge: number[];
  aufgaben: any[];
}

export function KartenTab({ data, setTab, setSelectedBS }: any) {
  const mapRef       = useRef<HTMLDivElement>(null);
  const leafletMap   = useRef<any>(null);
  const markersRef   = useRef<any[]>([]);
  const fzMarkersRef = useRef<any[]>([]);

  const [leafletLoaded, setLeafletLoaded] = useState(false);
  const [selectedBS,    setSelected]      = useState<GeoBS|null>(null);
  const [filter,        setFilter]        = useState({ status: "alle", team: "alle" });
  const [showFahrzeuge, setShowFahrzeuge] = useState(true);
  const [showBS,        setShowBS]        = useState(true);
  const [geocoding,     setGeocoding]     = useState(false);
  const [geocodingMsg,  setGeocodingMsg]  = useState("");

  // Leaflet CSS + JS laden
  useEffect(() => {
    if (document.getElementById("leaflet-css")) {
      setLeafletLoaded(true);
      return;
    }
    const css = document.createElement("link");
    css.id = "leaflet-css";
    css.rel = "stylesheet";
    css.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(css);

    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.onload = () => setLeafletLoaded(true);
    document.head.appendChild(script);
  }, []);

  // Karte initialisieren
  useEffect(() => {
    if (!leafletLoaded || !mapRef.current || leafletMap.current) return;

    leafletMap.current = L.map(mapRef.current, {
      center: [51.05, 13.74], // Dresden
      zoom: 11,
      zoomControl: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(leafletMap.current);

    return () => {
      if (leafletMap.current) {
        leafletMap.current.remove();
        leafletMap.current = null;
      }
    };
  }, [leafletLoaded]);

  // Marker aktualisieren wenn Daten oder Filter sich ändern
  useEffect(() => {
    if (!leafletLoaded || !leafletMap.current) return;
    updateMarkers();
  }, [leafletLoaded, data, filter, showFahrzeuge, showBS]);

  function makeIcon(farbe: string, typ: "baustelle" | "fahrzeug") {
    const emoji = typ === "baustelle" ? "⛏" : "🚛";
    return L.divIcon({
      className: "",
      html: `<div style="
        width: 36px; height: 36px; border-radius: 50% 50% 50% 0;
        background: ${farbe}; border: 2px solid #fff;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        transform: rotate(-45deg);
        display: flex; align-items: center; justify-content: center;
      "><span style="transform: rotate(45deg); font-size: 14px;">${emoji}</span></div>`,
      iconSize: [36, 36],
      iconAnchor: [18, 36],
      popupAnchor: [0, -36],
    });
  }

  function updateMarkers() {
    const map = leafletMap.current;
    if (!map) return;

    // Alte Marker entfernen
    markersRef.current.forEach(m => m.remove());
    fzMarkersRef.current.forEach(m => m.remove());
    markersRef.current = [];
    fzMarkersRef.current = [];

    // Baustellen-Marker
    if (showBS) {
      const gefiltert = data.baustellen.filter((b: any) => {
        if (!b.lat || !b.lng) return false;
        if (filter.status !== "alle" && b.status !== filter.status) return false;
        return true;
      });

      gefiltert.forEach((b: any) => {
        const farbe = STATUS_FARBEN[b.status] || "#888";
        const marker = L.marker([b.lat, b.lng], { icon: makeIcon(farbe, "baustelle") })
          .addTo(map)
          .on("click", () => {
            setSelected({
              ...b,
              mitarbeiter: Array.isArray(b.mitarbeiter) ? b.mitarbeiter.map(Number) : [],
              fahrzeuge:   Array.isArray(b.fahrzeuge)   ? b.fahrzeuge.map(Number)   : [],
              aufgaben:    Array.isArray(b.aufgaben)    ? b.aufgaben                 : [],
            });
          });
        markersRef.current.push(marker);
      });

      // Karte auf Baustellen zentrieren wenn vorhanden
      if (gefiltert.length > 0 && gefiltert[0].lat) {
        const bounds = L.latLngBounds(gefiltert.filter((b: any) => b.lat).map((b: any) => [b.lat, b.lng]));
        if (bounds.isValid()) map.fitBounds(bounds, { padding: [40, 40] });
      }
    }

    // Fahrzeug-Marker
    if (showFahrzeuge) {
      data.fahrzeuge.filter((f: any) => f.lat && f.lng).forEach((f: any) => {
        const farbe = f.status === "im Einsatz" ? "#BA7517" : f.status === "Wartung" ? "#E24B4A" : "#378ADD";
        const marker = L.marker([f.lat, f.lng], { icon: makeIcon(farbe, "fahrzeug") })
          .addTo(map)
          .bindTooltip(`<b>${f.name}</b><br>${f.status}<br>${f.fahrer || ""}`, { direction: "top" });
        fzMarkersRef.current.push(marker);
      });
    }
  }

  // Geocoding – Adresse zu Koordinaten
  async function geocodeAlle() {
    setGeocoding(true);
    const ohneKoords = data.baustellen.filter((b: any) => b.ort && (!b.lat || !b.lng));
    if (ohneKoords.length === 0) {
      setGeocodingMsg("✓ Alle Baustellen haben bereits Koordinaten");
      setGeocoding(false);
      setTimeout(() => setGeocodingMsg(""), 3000);
      return;
    }

    let ok = 0;
    for (const b of ohneKoords) {
      setGeocodingMsg(`Geocoding: ${b.name}...`);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(b.ort)}&format=json&limit=1`,
          { headers: { "Accept-Language": "de" } }
        );
        const d = await res.json();
        if (d?.[0]) {
          const lat = parseFloat(d[0].lat);
          const lng = parseFloat(d[0].lon);
          await supabase.from("baustellen").update({ lat, lng }).eq("id", b.id);
          ok++;
        }
        await new Promise(r => setTimeout(r, 1100)); // Nominatim Rate Limit
      } catch { /* ignorieren */ }
    }

    setGeocodingMsg(`✓ ${ok} von ${ohneKoords.length} Baustellen geocodiert`);
    setGeocoding(false);
    setTimeout(() => setGeocodingMsg(""), 4000);
    window.location.reload(); // Daten neu laden
  }

  // Baustellen ohne Koordinaten
  const ohneKoords = data.baustellen.filter((b: any) => b.ort && (!b.lat || !b.lng));
  const mitKoords  = data.baustellen.filter((b: any) => b.lat && b.lng);

  // Detail-Panel: Aufgaben, Team, Termine
  const getTeam = (bs: GeoBS) =>
    bs.mitarbeiter.map((id: number) => data.mitarbeiter.find((m: any) => m.id === id)).filter(Boolean);
  const getTermine = (bs: GeoBS) =>
    (data.termine || []).filter((t: any) => t.baustelle === bs.name)
      .sort((a: any, b: any) => a.datum.localeCompare(b.datum)).slice(0, 3);
  const getProg = (bs: GeoBS) => {
    const auf = bs.aufgaben || [];
    if (!auf.length) return 0;
    return Math.round(auf.filter((a: any) => a.erledigt).length / auf.length * 100);
  };
  const getDL = (ende?: string) => {
    if (!ende) return null;
    const dl = Math.ceil((new Date(ende).getTime() - Date.now()) / 86400000);
    return isNaN(dl) ? null : dl;
  };

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", gap: 0, position: "relative" }}>

      {/* Toolbar */}
      <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap", alignItems: "center" }}>

        {/* Status Filter */}
        <div style={{ display: "flex", gap: 4 }}>
          {["alle", "laufend", "geplant", "abgeschlossen"].map(s => (
            <button key={s} onClick={() => setFilter(f => ({ ...f, status: s }))}
              style={{ padding: "5px 12px", borderRadius: 8, border: "1.5px solid " + (filter.status === s ? ACCENT : "#eee"), background: filter.status === s ? "#e8f5f3" : "#fff", color: filter.status === s ? ACCENT : "#888", cursor: "pointer", fontSize: 11, fontWeight: filter.status === s ? 600 : 400 }}>
              {s === "alle" ? "Alle" : STATUS_ICONS[s] + " " + s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        {/* Layer Toggle */}
        <div style={{ display: "flex", gap: 4, marginLeft: "auto" }}>
          <button onClick={() => setShowBS(s => !s)}
            style={{ padding: "5px 10px", borderRadius: 8, border: "1.5px solid " + (showBS ? ACCENT : "#eee"), background: showBS ? "#e8f5f3" : "#fff", color: showBS ? ACCENT : "#888", cursor: "pointer", fontSize: 11 }}>
            ⛏ Baustellen
          </button>
          <button onClick={() => setShowFahrzeuge(s => !s)}
            style={{ padding: "5px 10px", borderRadius: 8, border: "1.5px solid " + (showFahrzeuge ? "#BA7517" : "#eee"), background: showFahrzeuge ? "#fff3e0" : "#fff", color: showFahrzeuge ? "#BA7517" : "#888", cursor: "pointer", fontSize: 11 }}>
            🚛 Fahrzeuge
          </button>
          <button onClick={geocodeAlle} disabled={geocoding}
            style={{ padding: "5px 10px", borderRadius: 8, border: "1.5px solid #eee", background: "#fff", color: "#555", cursor: geocoding ? "not-allowed" : "pointer", fontSize: 11, opacity: geocoding ? 0.7 : 1 }}>
            {geocoding ? "⟳ Geocoding..." : "📍 Adressen geocoden"}
          </button>
        </div>
      </div>

      {/* Geocoding Status */}
      {geocodingMsg && (
        <div style={{ padding: "6px 12px", background: "#e8f5f3", borderRadius: 8, fontSize: 12, color: ACCENT, marginBottom: 8 }}>
          {geocodingMsg}
        </div>
      )}

      {/* Warnung fehlende Koordinaten */}
      {ohneKoords.length > 0 && (
        <div style={{ padding: "6px 12px", background: "#fff8e1", borderRadius: 8, fontSize: 11, color: "#BA7517", marginBottom: 8 }}>
          ⚠ {ohneKoords.length} Baustelle{ohneKoords.length > 1 ? "n" : ""} ohne Koordinaten – klicke "Adressen geocoden"
        </div>
      )}

      {/* Karte + Detail Panel */}
      <div style={{ flex: 1, display: "flex", gap: 12, minHeight: 0, position: "relative" }}>

        {/* Karte */}
        <div style={{ flex: 1, position: "relative", borderRadius: 16, overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,0.10)" }}>
          <div ref={mapRef} style={{ width: "100%", height: "100%", minHeight: 400 }} />

          {!leafletLoaded && (
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "#f0f4f3" }}>
              <div style={{ textAlign: "center", color: "#bbb" }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>🗺</div>
                <div>Karte wird geladen...</div>
              </div>
            </div>
          )}

          {/* Stats Overlay */}
          <div style={{ position: "absolute", bottom: 16, left: 16, background: "rgba(255,255,255,0.92)", borderRadius: 10, padding: "8px 12px", fontSize: 11, color: "#555", boxShadow: "0 2px 8px rgba(0,0,0,0.15)", zIndex: 1000 }}>
            <div>🟢 {data.baustellen.filter((b: any) => b.status === "laufend").length} laufend</div>
            <div>🔵 {data.baustellen.filter((b: any) => b.status === "geplant").length} geplant</div>
            <div>🚛 {data.fahrzeuge.filter((f: any) => f.status === "im Einsatz").length} Fahrzeuge im Einsatz</div>
          </div>
        </div>

        {/* Detail Panel */}
        {selectedBS && (
          <div style={{ width: 300, background: "#fff", borderRadius: 16, boxShadow: "0 2px 12px rgba(0,0,0,0.10)", overflowY: "auto", padding: "16px", flexShrink: 0 }}>

            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12, paddingBottom: 12, borderBottom: "1px solid #f5f5f5" }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#222" }}>{selectedBS.name}</div>
                <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>📍 {selectedBS.ort}</div>
                <div style={{ display: "flex", gap: 6, marginTop: 4, alignItems: "center" }}>
                  <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 8, background: STATUS_FARBEN[selectedBS.status] + "22", color: STATUS_FARBEN[selectedBS.status], fontWeight: 600 }}>
                    {STATUS_ICONS[selectedBS.status]} {selectedBS.status}
                  </span>
                  {getDL(selectedBS.ende) !== null && (
                    <span style={{ fontSize: 10, color: getDL(selectedBS.ende)! <= 14 ? "#E24B4A" : "#bbb" }}>
                      {getDL(selectedBS.ende)}d
                    </span>
                  )}
                </div>
              </div>
              <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#bbb", fontSize: 18, padding: 0 }}>✕</button>
            </div>

            {/* Fortschritt */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#888", marginBottom: 4 }}>
                <span>Fortschritt</span>
                <span style={{ fontWeight: 600, color: ACCENT }}>{getProg(selectedBS)}%</span>
              </div>
              <div style={{ height: 6, background: "#eee", borderRadius: 3 }}>
                <div style={{ height: "100%", width: getProg(selectedBS) + "%", background: ACCENT, borderRadius: 3, transition: "width 0.3s" }} />
              </div>
            </div>

            {/* Aufgaben */}
            {selectedBS.aufgaben?.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#888", marginBottom: 6 }}>AUFGABEN</div>
                {selectedBS.aufgaben.slice(0, 5).map((a: any, i: number) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 0", borderBottom: "1px solid #f5f5f5" }}>
                    <div style={{ width: 14, height: 14, borderRadius: 4, border: "1.5px solid " + (a.erledigt ? ACCENT : "#ccc"), background: a.erledigt ? ACCENT : "#fff", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {a.erledigt && <span style={{ color: "#fff", fontSize: 8 }}>✓</span>}
                    </div>
                    <span style={{ fontSize: 11, color: a.erledigt ? "#bbb" : "#333", textDecoration: a.erledigt ? "line-through" : "none", flex: 1 }}>{a.titel}</span>
                  </div>
                ))}
                {selectedBS.aufgaben.length > 5 && <div style={{ fontSize: 10, color: "#bbb", marginTop: 4 }}>+{selectedBS.aufgaben.length - 5} weitere</div>}
              </div>
            )}

            {/* Team */}
            {getTeam(selectedBS).length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#888", marginBottom: 6 }}>TEAM</div>
                {getTeam(selectedBS).map((m: any) => (
                  <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 0" }}>
                    <div style={{ width: 24, height: 24, borderRadius: "50%", background: "#e8f5f3", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: ACCENT, flexShrink: 0 }}>
                      {m.name.split(" ").map((n: string) => n[0]).join("")}
                    </div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 500, color: "#222" }}>{m.name}</div>
                      <div style={{ fontSize: 10, color: "#aaa" }}>{m.rolle}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Termine */}
            {getTermine(selectedBS).length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#888", marginBottom: 6 }}>NÄCHSTE TERMINE</div>
                {getTermine(selectedBS).map((t: any) => (
                  <div key={t.id} style={{ display: "flex", gap: 8, padding: "4px 0", borderBottom: "1px solid #f5f5f5" }}>
                    <div style={{ width: 3, background: t.art === "Pflichttermin" ? "#E24B4A" : ACCENT, borderRadius: 2, flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 500, color: "#222" }}>{t.titel}</div>
                      <div style={{ fontSize: 10, color: "#aaa" }}>{new Date(t.datum).toLocaleDateString("de-DE")} {t.uhrzeit}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Navigation Button */}
            <button
              onClick={() => {
                if (setSelectedBS) setSelectedBS(selectedBS.id);
                if (setTab) setTab(3); // Baustellen Tab
              }}
              style={{ ...C.btnP, width: "100%", fontSize: 13, marginTop: 4 }}>
              → Zur Baustelle
            </button>
          </div>
        )}
      </div>

      {/* Legende */}
      <div style={{ display: "flex", gap: 12, marginTop: 8, fontSize: 11, color: "#888", flexWrap: "wrap" }}>
        <span>⛏ 🟢 Laufend</span>
        <span>⛏ 🔵 Geplant</span>
        <span>⛏ ⚫ Abgeschlossen</span>
        <span style={{ marginLeft: "auto" }}>🚛 🟡 Im Einsatz &nbsp; 🔴 Wartung &nbsp; 🔵 Verfügbar</span>
      </div>
    </div>
  );
}
