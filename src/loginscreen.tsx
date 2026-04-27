import { useState } from "react";
import { ACCENT, C } from "./lib/constants";
import { ROLLEN_LABEL } from "./rollen";
import type { Rolle } from "./rollen";

interface LoginScreenProps {
  mitarbeiter: any[];
  onLogin: (user: any) => void;
}

export function LoginScreen({ mitarbeiter, onLogin }: LoginScreenProps) {
  const [name,    setName]    = useState("");
  const [passwort, setPasswort] = useState("");
  const [fehler,  setFehler]  = useState("");
  const [showPw,  setShowPw]  = useState(false);
  const [vorschlaege, setVorschlaege] = useState<any[]>([]);

  const loginUser = mitarbeiter.filter((m: any) => m.rolle_system && m.pin);

  // Name-Eingabe mit Vorschlägen
  function handleNameChange(val: string) {
    setName(val);
    setFehler("");
    if (val.length > 0) {
      const matches = loginUser.filter((m: any) =>
        m.name.toLowerCase().includes(val.toLowerCase())
      );
      setVorschlaege(matches.slice(0, 5));
    } else {
      setVorschlaege([]);
    }
  }

  function selectName(m: any) {
    setName(m.name);
    setVorschlaege([]);
  }

  function handleLogin() {
    if (!name.trim()) { setFehler("Bitte Namen eingeben."); return; }
    if (!passwort) { setFehler("Bitte Passwort eingeben."); return; }

    // Suche Mitarbeiter nach Name (case-insensitive)
    const user = loginUser.find((m: any) =>
      m.name.toLowerCase() === name.trim().toLowerCase()
    );

    if (!user) { setFehler("Name nicht gefunden."); return; }
    if (passwort !== user.pin) { setFehler("Falsches Passwort."); setPasswort(""); return; }

    setFehler("");
    onLogin(user);
  }

  return (
    <div style={{ fontFamily: "system-ui,sans-serif", height: "100vh", overflow: "hidden", background: "linear-gradient(135deg, #e8f5f3 0%, #f0f4f3 100%)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ ...C.card, width: "min(420px,95vw)", padding: "32px 28px", boxShadow: "0 8px 40px rgba(0,0,0,0.10)" }}>

        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ width: 64, height: 64, borderRadius: 18, background: ACCENT, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, fontWeight: 700, color: "#fff", margin: "0 auto 14px" }}>BM</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#222" }}>BauManager</div>
          <div style={{ fontSize: 13, color: "#aaa", marginTop: 4 }}>Bitte einloggen</div>
        </div>

        {/* Name Eingabe */}
        <div style={{ marginBottom: 14, position: "relative" }}>
          <label style={C.lbl}>Name</label>
          <input
            type="text"
            value={name}
            onChange={e => handleNameChange(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") document.getElementById("pw-input")?.focus(); }}
            placeholder="Vor- und Nachname"
            autoComplete="off"
            style={{ ...C.inp, fontSize: 15, padding: "12px 14px" }}
          />

          {/* Vorschläge */}
          {vorschlaege.length > 0 && (
            <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#fff", border: "1px solid #e8eaed", borderRadius: 10, boxShadow: "0 4px 16px rgba(0,0,0,0.10)", zIndex: 100, marginTop: 4 }}>
              {vorschlaege.map((m: any) => (
                <button key={m.id}
                  onClick={() => selectName(m)}
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", padding: "10px 14px", border: "none", background: "transparent", cursor: "pointer", textAlign: "left", borderBottom: "1px solid #f5f5f5" }}
                >
                  <span style={{ fontSize: 13, fontWeight: 500, color: "#222" }}>{m.name}</span>
                  <span style={{ fontSize: 11, color: "#aaa" }}>{ROLLEN_LABEL[m.rolle_system as Rolle] || m.rolle_system}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Passwort Eingabe */}
        <div style={{ marginBottom: 20 }}>
          <label style={C.lbl}>Passwort</label>
          <div style={{ position: "relative" }}>
            <input
              id="pw-input"
              type={showPw ? "text" : "password"}
              value={passwort}
              onChange={e => { setPasswort(e.target.value); setFehler(""); }}
              onKeyDown={e => { if (e.key === "Enter") handleLogin(); }}
              placeholder="Passwort eingeben"
              style={{ ...C.inp, fontSize: 15, padding: "12px 44px 12px 14px", marginBottom: 0 }}
            />
            <button
              onClick={() => setShowPw(s => !s)}
              style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "#aaa" }}
            >
              {showPw ? "🙈" : "👁"}
            </button>
          </div>
          <div style={{ fontSize: 10, color: "#bbb", marginTop: 5 }}>
            Min. 10 Zeichen: Groß- & Kleinbuchstaben, Zahlen, Sonderzeichen
          </div>
        </div>

        {/* Fehler */}
        {fehler && (
          <div style={{ background: "#E24B4A18", border: "1px solid #E24B4A44", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "#E24B4A", marginBottom: 14, textAlign: "center" }}>
            {fehler}
          </div>
        )}

        {/* Login Button */}
        <button
          onClick={handleLogin}
          disabled={!name || !passwort}
          style={{ ...C.btnP, width: "100%", padding: "13px", fontSize: 15, opacity: (!name || !passwort) ? 0.5 : 1, cursor: (!name || !passwort) ? "not-allowed" : "pointer" }}
        >
          Einloggen
        </button>

        {/* Hinweis */}
        <div style={{ fontSize: 11, color: "#bbb", textAlign: "center", marginTop: 16 }}>
          Kein Zugang? Wende dich an deinen Administrator.
        </div>
      </div>
    </div>
  );
}
