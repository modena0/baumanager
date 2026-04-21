import { useState } from "react";
import { ACCENT, C } from "./lib/constants";
import { ROLLEN_LABEL } from "./rollen";
import type { Rolle } from "./rollen";

interface LoginScreenProps {
  mitarbeiter: any[];
  onLogin: (user: any) => void;
}

export function LoginScreen({ mitarbeiter, onLogin }: LoginScreenProps) {
  const [selected, setSelected] = useState<any>(null);
  const [pin, setPin]           = useState("");
  const [fehler, setFehler]     = useState("");

  const loginUser = mitarbeiter.filter((m: any) => m.rolle_system && m.pin);

  function handleLogin() {
    if (!selected) { setFehler("Bitte eine Person auswählen."); return; }
    if (pin !== selected.pin) { setFehler("Falsche PIN."); setPin(""); return; }
    setFehler("");
    onLogin(selected);
  }

  return (
    <div style={{ fontFamily: "system-ui,sans-serif", height: "100vh", overflow: "hidden", background: "#f0f4f3", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ ...C.card, width: "min(400px,95vw)", textAlign: "center" }}>

        {/* Logo */}
        <div style={{ width: 56, height: 56, borderRadius: 14, background: ACCENT, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 700, color: "#fff", margin: "0 auto 16px" }}>BM</div>
        <div style={{ fontSize: 20, fontWeight: 700, color: "#222", marginBottom: 4 }}>BauManager</div>
        <div style={{ fontSize: 12, color: "#aaa", marginBottom: 24 }}>Bitte einloggen</div>

        {/* Person auswählen */}
        <div style={{ marginBottom: 12, textAlign: "left" }}>
          <label style={C.lbl}>Person auswählen</label>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 200, overflowY: "auto" }}>
            {loginUser.map((m: any) => (
              <button
                key={m.id}
                onClick={() => { setSelected(m); setPin(""); setFehler(""); }}
                style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "10px 14px", borderRadius: 10,
                  border: "1.5px solid " + (selected?.id === m.id ? ACCENT : "#e8eaed"),
                  background: selected?.id === m.id ? "#e8f5f3" : "#fff",
                  cursor: "pointer", textAlign: "left",
                }}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#222" }}>{m.name}</div>
                  <div style={{ fontSize: 11, color: "#aaa" }}>{ROLLEN_LABEL[m.rolle_system as Rolle] || m.rolle_system}</div>
                </div>
                {selected?.id === m.id && <span style={{ color: ACCENT, fontSize: 16 }}>✓</span>}
              </button>
            ))}
            {loginUser.length === 0 && (
              <div style={{ fontSize: 12, color: "#bbb", padding: 12, textAlign: "center" }}>
                Keine Benutzer angelegt.<br />Bitte erst in Supabase PIN und Rolle vergeben.
              </div>
            )}
          </div>
        </div>

        {/* PIN Eingabe */}
        {selected && (
          <div style={{ marginBottom: 12, textAlign: "left" }}>
            <label style={C.lbl}>PIN eingeben</label>
            <input
              type="password"
              maxLength={4}
              value={pin}
              onChange={e => { setPin(e.target.value); setFehler(""); }}
              onKeyDown={e => { if (e.key === "Enter") handleLogin(); }}
              placeholder="••••"
              autoFocus
              style={{ ...C.inp, textAlign: "center", fontSize: 20, letterSpacing: 8 }}
            />
          </div>
        )}

        {/* Fehler */}
        {fehler && <div style={{ color: "#E24B4A", fontSize: 12, marginBottom: 12 }}>{fehler}</div>}

        {/* Login Button */}
        <button
          onClick={handleLogin}
          disabled={!selected || pin.length < 4}
          style={{ ...C.btnP, width: "100%", opacity: (!selected || pin.length < 4) ? 0.5 : 1, cursor: (!selected || pin.length < 4) ? "not-allowed" : "pointer", marginBottom: 16 }}
        >
          Einloggen
        </button>

        {/* PIN-Pad */}
        {selected && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            {[1,2,3,4,5,6,7,8,9,"",0,"⌫"].map((k, i) => (
              <button
                key={i}
                onClick={() => {
                  if (k === "⌫") setPin(p => p.slice(0, -1));
                  else if (k !== "" && pin.length < 4) setPin(p => p + k);
                }}
                style={{
                  padding: "14px",
                  borderRadius: 10,
                  border: k === "" ? "none" : "1.5px solid #e8eaed",
                  background: k === "" ? "transparent" : "#fff",
                  cursor: k === "" ? "default" : "pointer",
                  fontSize: 18, fontWeight: 500, color: "#333",
                } as any}
              >
                {k}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
