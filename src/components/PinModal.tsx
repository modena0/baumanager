import { useState } from "react";
import { C, ACCENT, ADMIN_PIN } from "../lib/constants";

export function PinModal({ onSuccess, onCancel }: { onSuccess: () => void; onCancel: () => void }) {
  const [pin, setPin] = useState("");
  const [err, setErr] = useState(false);

  const check = () => {
    if (pin === ADMIN_PIN) onSuccess();
    else { setErr(true); setPin(""); }
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.3)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:300 }}>
      <div style={{ ...C.card, width:"min(320px,90vw)", textAlign:"center" }}>
        <div style={{ fontSize:36, marginBottom:8 }}>🔒</div>
        <div style={{ fontWeight:700, fontSize:16, marginBottom:4 }}>Admin-Zugang</div>
        <div style={{ fontSize:13, color:"#bbb", marginBottom:16 }}>PIN: 1234</div>
        <input
          style={{ ...C.inp, textAlign:"center", fontSize:22, letterSpacing:8 }}
          type="password" maxLength={6} value={pin}
          onChange={e => { setPin(e.target.value); setErr(false); }}
          onKeyDown={e => { if (e.key === "Enter") check(); }}
          placeholder="...."
        />
        {err && <div style={{ color:"#E24B4A", fontSize:12, marginBottom:8 }}>Falscher PIN</div>}
        <div style={{ display:"flex", gap:8, justifyContent:"center", marginTop:8 }}>
          <button style={C.btnS} onClick={onCancel}>Abbrechen</button>
          <button style={C.btnP} onClick={check}>OK</button>
        </div>
      </div>
    </div>
  );
}