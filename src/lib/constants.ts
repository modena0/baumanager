export const ADMIN_PIN = "1234";
export const ACCENT = "#4DB6AC";

export const NAV = [
  { id: 0, label: "Dashboard",   icon: "⊞" },
  { id: 4, label: "Kalender",    icon: "▦" },
  { id: 1, label: "Mitarbeiter", icon: "👤" },
  { id: 3, label: "Baustellen",  icon: "⛏" },
  { id: 6, label: "Fuhrpark",    icon: "🚛" },
  { id: 5, label: "Lager",       icon: "📦" },
  { id: 2, label: "Zuordnung",   icon: "⇄" },
  { id: 7, label: "KI",          icon: "✦" },
];

export const BS_KAT  = ["Tiefbau", "LSA", "Straße"];
export const MA_KAT  = ["LKW Fahrer", "Tiefbau", "LSA", "Sonstige"];
export const T_ARTEN = ["Pflichttermin", "Besprechung", "Lieferung", "Abnahme", "Behoerde", "Sonstiges"];

export const T_COL: Record<string, string> = {
  Pflichttermin: "#E24B4A", Besprechung: "#4DB6AC", Lieferung: "#BA7517",
  Abnahme: "#4DB6AC", Behoerde: "#7F77DD", Sonstiges: "#888",
};
export const ST_COL: Record<string, string> = {
  aktiv: "#4DB6AC", "verfügbar": "#4DB6AC", "im Einsatz": "#4DB6AC",
  Wartung: "#BA7517", geplant: "#7986CB", laufend: "#4DB6AC",
  abgeschlossen: "#888", krank: "#E24B4A", Urlaub: "#BA7517", defekt: "#E24B4A",
};
export const MN = ["Januar","Februar","März","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"];
export const DN = ["Mo","Di","Mi","Do","Fr","Sa","So"];

export const C: Record<string, React.CSSProperties> = {
  card: { background: "#fff", borderRadius: 16, padding: 20, boxShadow: "0 2px 12px rgba(0,0,0,0.06)" },
  inp:  { width: "100%", padding: "9px 13px", borderRadius: 10, border: "1.5px solid #e8eaed", background: "#fff", color: "#222", fontSize: 13, marginBottom: 8, boxSizing: "border-box", outline: "none" },
  lbl:  { fontSize: 12, color: "#888", marginBottom: 3, display: "block", marginTop: 8, fontWeight: 500 },
  btnP: { padding: "8px 18px", borderRadius: 10, border: "none", background: ACCENT, cursor: "pointer", fontSize: 13, color: "#fff", fontWeight: 600 },
  btnS: { padding: "8px 18px", borderRadius: 10, border: "1.5px solid #e8eaed", background: "#fff", cursor: "pointer", fontSize: 13, color: "#444", fontWeight: 500 },
  th:   { textAlign: "left", padding: "10px 14px", color: "#aaa", fontWeight: 500, fontSize: 12, borderBottom: "1px solid #f0f0f0" },
  td:   { padding: "10px 14px", borderBottom: "1px solid #f5f5f5", color: "#333", verticalAlign: "middle", fontSize: 13 },
  r2:   { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
  r3:   { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 },
  tag:  { display: "inline-block", padding: "2px 8px", borderRadius: 20, fontSize: 11, background: "#f0f0f0", color: "#666", marginRight: 4, marginBottom: 2 },
};

export const INIT = {
  mitarbeiter: [
    { id:1, name:"Thomas Müller",   rolle:"Kranführer",  kategorie:"LKW Fahrer", qualifikationen:["Kran","LKW Klasse C"],                    fuehrerschein:["B","C","CE"],     zertifikate:"Kranführerschein G25", baustelle:"Baustelle A", status:"aktiv",     telefon:"0351 12345", adresse:"Hauptstr. 12 Dresden",   geburtsdatum:"1985-03-15", eintrittsdatum:"2018-06-01", stundenlohn:28, vertragsart:"Vollzeit", urlaubstage:30, urlaubGenommen:5,  notfallkontakt:"Maria Müller",  bemerkungen:"Teamleiter",     gutMit:[2,4], nichtMit:[] },
    { id:2, name:"Stefan Koch",     rolle:"Maurer",      kategorie:"Sonstige",   qualifikationen:["Hochbau","Betonarbeiten"],                 fuehrerschein:["B"],              zertifikate:"Maurergeselle",       baustelle:"Baustelle B", status:"aktiv",     telefon:"0351 22222", adresse:"Bergweg 5 Dresden",      geburtsdatum:"1990-07-22", eintrittsdatum:"2020-03-01", stundenlohn:22, vertragsart:"Vollzeit", urlaubstage:28, urlaubGenommen:10, notfallkontakt:"Petra Koch",    bemerkungen:"",               gutMit:[1],   nichtMit:[3] },
    { id:3, name:"Andreas Bauer",   rolle:"Fahrer",      kategorie:"LKW Fahrer", qualifikationen:["LKW Transport","Logistik"],                fuehrerschein:["B","C","CE","D"], zertifikate:"ADR Gefahrgut",       baustelle:"-",           status:"verfügbar", telefon:"0351 33333", adresse:"Seestr. 8 Dresden",      geburtsdatum:"1988-11-05", eintrittsdatum:"2019-09-15", stundenlohn:24, vertragsart:"Vollzeit", urlaubstage:28, urlaubGenommen:0,  notfallkontakt:"Keine",         bemerkungen:"Gefahrgutfahrer", gutMit:[4],   nichtMit:[2] },
    { id:4, name:"Klaus Werner",    rolle:"Polier",      kategorie:"Tiefbau",    qualifikationen:["Tiefbau","Sprengung","Projektleitung"],     fuehrerschein:["B","C"],          zertifikate:"Polier IHK",          baustelle:"Baustelle A", status:"aktiv",     telefon:"0351 44444", adresse:"Lindenallee 3 Dresden",  geburtsdatum:"1978-01-30", eintrittsdatum:"2015-01-01", stundenlohn:35, vertragsart:"Vollzeit", urlaubstage:30, urlaubGenommen:8,  notfallkontakt:"Ursula Werner", bemerkungen:"Senior-Polier",  gutMit:[1,3], nichtMit:[] },
    { id:5, name:"Frank Schreiber", rolle:"Elektriker",  kategorie:"LSA",        qualifikationen:["Elektroinstallation","Sicherheitstechnik"], fuehrerschein:["B"],             zertifikate:"Elektrofachkraft",    baustelle:"-",           status:"verfügbar", telefon:"0351 55555", adresse:"Ringstr. 20 Dresden",    geburtsdatum:"1992-04-18", eintrittsdatum:"2021-05-01", stundenlohn:26, vertragsart:"Vollzeit", urlaubstage:28, urlaubGenommen:2,  notfallkontakt:"Keine",         bemerkungen:"",               gutMit:[],    nichtMit:[] },
  ],
  baustellen: [
    { id:1, name:"Baustelle A", ort:"Dresden Neustadt", kategorie:"Hochbau", anforderungen:["Kran","LKW Klasse C"],      status:"laufend",  start:"2026-03-01", ende:"2026-08-30", mitarbeiter:[1,4], fahrzeuge:[1,2], equipment:[], beschreibung:"Wohngebäude 5-stöckig", aufgaben:[{id:1,titel:"Fundament giessen",erledigt:true},{id:2,titel:"Rohbau Erdgeschoss",erledigt:true},{id:3,titel:"Rohbau 1. OG",erledigt:false},{id:4,titel:"Elektroinstallation",erledigt:false},{id:5,titel:"Fenster einsetzen",erledigt:false}] },
    { id:2, name:"Baustelle B", ort:"Dresden Mitte",    kategorie:"Hochbau", anforderungen:["Hochbau","Betonarbeiten"],  status:"laufend",  start:"2026-04-01", ende:"2026-07-15", mitarbeiter:[2],   fahrzeuge:[3],   equipment:[], beschreibung:"Buerogebaeude Neubau",  aufgaben:[{id:1,titel:"Aushub",erledigt:true},{id:2,titel:"Fundament",erledigt:true},{id:3,titel:"Stahlbeton Decke",erledigt:false},{id:4,titel:"Innenausbau",erledigt:false}] },
    { id:3, name:"Baustelle C", ort:"Leipzig Nord",     kategorie:"Tiefbau", anforderungen:["Tiefbau","Sprengung"],      status:"geplant",  start:"2026-06-01", ende:"2026-12-31", mitarbeiter:[],    fahrzeuge:[],    equipment:[], beschreibung:"Tunnelabschnitt",       aufgaben:[] },
  ],
  termine: [
    { id:1, titel:"Behoerdenabnahme",      datum:"2026-04-18", uhrzeit:"09:00", art:"Pflichttermin", baustelle:"Baustelle A", beschreibung:"Statikpruefung", erinnerung:true  },
    { id:2, titel:"Materiallieferung Beton",datum:"2026-04-22", uhrzeit:"07:00", art:"Lieferung",     baustelle:"Baustelle B", beschreibung:"30m3 Beton",     erinnerung:false },
    { id:3, titel:"Wochenbesprechung",     datum:"2026-04-21", uhrzeit:"08:00", art:"Besprechung",   baustelle:"Alle",        beschreibung:"Teamrunde",       erinnerung:true  },
    { id:4, titel:"TUeV Pruefung",         datum:"2026-04-20", uhrzeit:"13:00", art:"Pflichttermin", baustelle:"Alle",        beschreibung:"LKW 01 und 02",   erinnerung:true  },
  ],
  lager: [
    { id:1, name:"Betonmischer",  kategorie:"Maschine", anzahl:3,  verfuegbar:2,  zugewiesen:"Baustelle A", mindestbestand:1  },
    { id:2, name:"Bohrmaschinen", kategorie:"Werkzeug", anzahl:10, verfuegbar:6,  zugewiesen:"diverses",    mindestbestand:3  },
    { id:3, name:"Schutzhelme",   kategorie:"PSA",      anzahl:50, verfuegbar:34, zugewiesen:"diverses",    mindestbestand:10 },
    { id:4, name:"Betonpumpe",    kategorie:"Maschine", anzahl:1,  verfuegbar:0,  zugewiesen:"Baustelle B", mindestbestand:1  },
  ],
  fahrzeuge: [
    { id:1, name:"LKW 01 MAN TGX",       typ:"LKW",         kennzeichen:"DD-BU 101", status:"im Einsatz", baustelle:"Baustelle A", fahrer:"Thomas Müller", lat:51.065, lng:13.745, aufgabe:"Materialtransport", freiAb:"" },
    { id:2, name:"LKW 02 Mercedes",      typ:"LKW",         kennzeichen:"DD-BU 102", status:"verfügbar",  baustelle:"-",           fahrer:"-",             lat:51.050, lng:13.740, aufgabe:"-",                freiAb:"" },
    { id:3, name:"Bagger 01 Liebherr",   typ:"Bagger",      kennzeichen:"DD-BU 201", status:"im Einsatz", baustelle:"Baustelle B", fahrer:"Andreas Bauer", lat:51.053, lng:13.735, aufgabe:"Erdarbeiten",      freiAb:"16:00" },
    { id:4, name:"Transporter VW Crafter",typ:"Transporter", kennzeichen:"DD-BU 301", status:"Wartung",    baustelle:"-",           fahrer:"-",             lat:51.060, lng:13.750, aufgabe:"Werkstatt",        freiAb:"Morgen" },
  ],
};
