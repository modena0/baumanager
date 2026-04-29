import { useState, useEffect, useRef } from "react";
import { ACCENT } from "../../lib/constants";
import { supabase } from "../../lib/supabase";

interface Nachricht {
  id?: number;
  baustelle_id: number;
  datum: string;
  text?: string;
  foto_url?: string;
  absender: string;
  absender_rolle?: string;
  typ: string;
  ki_verarbeitet: boolean;
  created_at?: string;
}

// Direkter API-Call mit eigenem Key!
async function kiAPI(prompt: string, systemPrompt?: string): Promise<string> {
  const apiKey = import.meta.env.VITE_ANTHROPIC_KEY;
  if (!apiKey) throw new Error("Kein API-Key konfiguriert (VITE_ANTHROPIC_KEY)");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      system: systemPrompt || "Du bist Sascha, ein Bautagebuch-Assistent.",
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`API Fehler ${res.status}: ${err.slice(0, 100)}`);
  }

  const d = await res.json();
  return d.content?.[0]?.text?.trim() || "Keine Antwort";
}

export function ChatTab({ bsId, bsName, datum, currentUser, rolle }: any) {
  const [nachrichten, setNachrichten] = useState<Nachricht[]>([]);
  const [text,         setText]         = useState("");
  const [sending,      setSending]      = useState(false);
  const [saschaTyping, setSaschaTyping] = useState(false);
  const [kiLaeuft,     setKiLaeuft]    = useState(false);
  const [fotoSending,  setFotoSending]  = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const isMobile = window.innerWidth < 768;
  const ichBin = currentUser?.name || "";

  useEffect(() => {
    laden();
    const iv = setInterval(laden, 10000);
    return () => clearInterval(iv);
  }, [bsId, datum]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [nachrichten, saschaTyping]);

  async function laden() {
    const { data } = await supabase
      .from("chat_nachrichten")
      .select("*")
      .eq("baustelle_id", bsId)
      .eq("datum", datum)
      .order("created_at");
    if (data) setNachrichten(data);
  }

  async function sendText() {
    if (!text.trim() || sending) return;
    const txt = text.trim();
    setText("");
    setSending(true);

    const n: Nachricht = {
      baustelle_id: bsId, datum, text: txt,
      absender: ichBin || "Unbekannt",
      absender_rolle: rolle, typ: "text", ki_verarbeitet: false,
    };

    const { data: neu } = await supabase.from("chat_nachrichten").insert([n]).select().single();
    const gespeichert = neu ? { ...n, id: neu.id, created_at: neu.created_at } : n;
    setSending(false);

    setNachrichten(prev => {
      const aktualisiert = [...prev, gespeichert];
      setTimeout(() => saschaAntwortet(txt, aktualisiert), 0);
      return aktualisiert;
    });
  }

  async function sendFoto(files: FileList) {
    if (!files.length) return;
    setFotoSending(true);
    for (const file of Array.from(files)) {
      const fileName = `chat/${bsId}/${datum}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { data: up, error } = await supabase.storage.from("dokumente").upload(fileName, file, { upsert: true });
      let url = "";
      if (!error && up) {
        url = supabase.storage.from("dokumente").getPublicUrl(fileName).data.publicUrl;
      } else {
        url = await new Promise<string>(res => {
          const r = new FileReader();
          r.onload = ev => {
            const img = new Image();
            img.onload = () => {
              const c = document.createElement("canvas");
              let w = img.width, h = img.height;
              if (w > 800) { h = h * 800 / w; w = 800; }
              c.width = w; c.height = h;
              c.getContext("2d")?.drawImage(img, 0, 0, w, h);
              res(c.toDataURL("image/jpeg", 0.7));
            };
            img.src = ev.target?.result as string;
          };
          r.readAsDataURL(file);
        });
      }
      if (!url) continue;
      const n: Nachricht = {
        baustelle_id: bsId, datum, foto_url: url, typ: "foto",
        absender: ichBin || "Unbekannt", absender_rolle: rolle, ki_verarbeitet: false,
      };
      const { data: neu } = await supabase.from("chat_nachrichten").insert([n]).select().single();
      if (neu) {
        const gespeichert = { ...n, id: neu.id, created_at: neu.created_at };
        setNachrichten(prev => {
          const aktualisiert = [...prev, gespeichert];
          setTimeout(() => saschaAntwortet("[Foto gesendet]", aktualisiert), 0);
          return aktualisiert;
        });
      }
    }
    setFotoSending(false);
  }

  async function saschaAntwortet(userText: string, verlauf: Nachricht[]) {
    setSaschaTyping(true);
    const verlaufText = verlauf.slice(-10)
      .map(n => `${n.absender}: ${n.text || "[Foto]"}`)
      .join("\n");

    const prompt = `BAUSTELLE: ${bsName} | DATUM: ${datum}
VERLAUF:
${verlaufText}

NEUE NACHRICHT von ${ichBin || "Mitarbeiter"}: "${userText}"

Reagiere natürlich. Bestätige kurz was du verstanden hast. Stelle maximal EINE Rückfrage wenn wichtige Info fehlt. Max 2-3 Sätze.`;

    try {
      const antwort = await kiAPI(
        prompt,
        "Du bist Sascha, ein freundlicher Bautagebuch-Assistent. Antworte wie ein erfahrener Kollege: locker, kurz, direkt, auf Deutsch. Kein Markdown."
      );

      await new Promise(r => setTimeout(r, 400));

      const sascha: Nachricht = {
        baustelle_id: bsId, datum, text: antwort, typ: "text",
        absender: "Sascha", absender_rolle: "KI-Assistent", ki_verarbeitet: true,
      };
      const { data: neu } = await supabase.from("chat_nachrichten").insert([sascha]).select().single();
      if (neu) setNachrichten(prev => [...prev, { ...sascha, id: neu.id, created_at: neu.created_at }]);

    } catch (e: any) {
      console.error("Sascha:", e.message);
    } finally {
      setSaschaTyping(false);
    }
  }

  async function kiVerarbeitung() {
    const zuVerarbeiten = nachrichten.filter(n => !n.ki_verarbeitet && n.absender !== "Sascha");
    if (!zuVerarbeiten.length) { alert("Keine neuen Nachrichten zum Verarbeiten."); return; }
    setKiLaeuft(true);

    const prompt = `Analysiere diese Nachrichten von Baustelle "${bsName}" (${datum}) und antworte NUR mit validem JSON:
{"notizen":"Zusammenfassung","besonderheiten":null,"arbeitsbeginn":null,"arbeitsende":null,"materialien":[{"materialart":"Name","menge":0,"einheit":"m³","einbauort":"Ort","status":"verbaut"}]}

NACHRICHTEN:
${zuVerarbeiten.map(n => `${n.absender}: ${n.text || "[Foto]"}`).join("\n")}`;

    try {
      const kiTxt = await kiAPI(prompt, "Extrahiere Baudaten als JSON. Antworte NUR mit validem JSON.");
      const match = kiTxt.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("Kein JSON: " + kiTxt.slice(0, 100));
      const ki = JSON.parse(match[0]);

      // Eintrag laden oder anlegen
      let { data: eintr } = await supabase.from("bautagebuch_eintraege")
        .select("*").eq("baustelle_id", bsId).eq("datum", datum).maybeSingle();
      if (!eintr) {
        const { data: neu } = await supabase.from("bautagebuch_eintraege").insert([{
          baustelle_id: bsId, datum, mitarbeiter_anwesend: [], geraete: [], erstellt_von: "Sascha KI",
        }]).select().single();
        eintr = neu;
      }

      if (eintr) {
        const update: any = {};
        if (ki.notizen) update.notizen = eintr.notizen
          ? eintr.notizen + "\n\n[Sascha " + new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }) + "]: " + ki.notizen
          : ki.notizen;
        if (ki.besonderheiten) update.besonderheiten = ki.besonderheiten;
        if (ki.arbeitsbeginn)  update.arbeitsbeginn  = ki.arbeitsbeginn;
        if (ki.arbeitsende)    update.arbeitsende     = ki.arbeitsende;
        if (Object.keys(update).length)
          await supabase.from("bautagebuch_eintraege").update(update).eq("id", eintr.id);

        for (const m of (ki.materialien || [])) {
          if (!m.materialart) continue;
          const mp: any = {
            baustelle_id: bsId, datum, eintrag_id: eintr.id,
            materialart: m.materialart, status: m.status || "verbaut", erstellt_von: "Sascha KI",
          };
          if (m.menge)   mp.menge   = m.menge;
          if (m.einheit) mp.einheit = m.einheit;
          if (m.einbauort && m.einbauort !== "null") mp.einbauort = m.einbauort;
          await supabase.from("bautagebuch_material").insert([mp]);
        }
      }

      for (const n of zuVerarbeiten)
        if (n.id) await supabase.from("chat_nachrichten").update({ ki_verarbeitet: true }).eq("id", n.id);

      setNachrichten(prev => prev.map(n =>
        zuVerarbeiten.find(u => u.id === n.id) ? { ...n, ki_verarbeitet: true } : n
      ));
      alert(`✓ ${zuVerarbeiten.length} Nachrichten verarbeitet!`);

    } catch (e: any) {
      alert("Fehler: " + e.message);
    }
    setKiLaeuft(false);
  }

  const unverarbeitet = nachrichten.filter(n => !n.ki_verarbeitet && n.absender !== "Sascha").length;
  const getRolleColor = (r: string) => r === "admin" || r === "chef" ? "#7986CB" : r === "polier" ? "#BA7517" : ACCENT;
  const formatTime = (iso?: string) => iso ? new Date(iso).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }) : "";

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>

      {unverarbeitet > 0 && (
        <div style={{ flexShrink: 0, padding: "6px 12px", background: "#f3e5f5", borderRadius: 8, marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 11, color: "#9C27B0" }}>✦ {unverarbeitet} Nachricht{unverarbeitet > 1 ? "en" : ""} noch nicht in Tageslog übertragen</span>
          <button onClick={kiVerarbeitung} disabled={kiLaeuft}
            style={{ fontSize: 11, padding: "3px 10px", borderRadius: 6, border: "1px solid #9C27B0", background: "#fff", color: "#9C27B0", cursor: "pointer", opacity: kiLaeuft ? 0.6 : 1 }}>
            {kiLaeuft ? "⏳ Verarbeite..." : "✦ Jetzt übertragen"}
          </button>
        </div>
      )}

      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "8px 0", display: "flex", flexDirection: "column", gap: 3 }}>
        {nachrichten.length === 0 && (
          <div style={{ textAlign: "center", color: "#bbb", padding: 48 }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>💬</div>
            <div style={{ fontSize: 14, marginBottom: 4, fontWeight: 600 }}>Hallo! Ich bin Sascha.</div>
            <div style={{ fontSize: 12 }}>Schreib einfach was heute auf der Baustelle passiert ist.</div>
          </div>
        )}

        {nachrichten.map((n, idx) => {
          const ichBinSender = n.absender === ichBin;
          const isSascha = n.absender === "Sascha";
          const vorherigerGleicher = idx > 0 && nachrichten[idx - 1].absender === n.absender;
          return (
            <div key={n.id || idx} style={{ display: "flex", flexDirection: ichBinSender ? "row-reverse" : "row", alignItems: "flex-end", gap: 6, padding: "1px 12px" }}>
              {!ichBinSender && (
                <div style={{ width: 30, height: 30, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: isSascha ? 15 : 11, fontWeight: 700, color: "#fff", background: vorherigerGleicher ? "transparent" : isSascha ? ACCENT : getRolleColor(n.absender_rolle || "") }}>
                  {!vorherigerGleicher && (isSascha ? "🤖" : n.absender.split(" ").map((x: string) => x[0]).join("").slice(0, 2))}
                </div>
              )}
              <div style={{ maxWidth: isMobile ? "78%" : "62%", display: "flex", flexDirection: "column", alignItems: ichBinSender ? "flex-end" : "flex-start" }}>
                {!ichBinSender && !vorherigerGleicher && (
                  <div style={{ fontSize: 10, fontWeight: 600, marginBottom: 2, marginLeft: 4, color: isSascha ? ACCENT : getRolleColor(n.absender_rolle || "") }}>
                    {isSascha ? "✦ Sascha" : n.absender}
                    {!isSascha && n.absender_rolle && <span style={{ fontWeight: 400, color: "#bbb" }}> · {n.absender_rolle}</span>}
                  </div>
                )}
                <div style={{ background: ichBinSender ? ACCENT : isSascha ? "#e8f8f5" : "#fff", color: ichBinSender ? "#fff" : "#222", borderRadius: ichBinSender ? "18px 18px 4px 18px" : "18px 18px 18px 4px", padding: n.typ === "foto" ? 4 : "10px 14px", boxShadow: "0 1px 4px rgba(0,0,0,0.08)", border: isSascha ? "1px solid " + ACCENT + "44" : "none" }}>
                  {n.typ === "text" && <div style={{ fontSize: 13, lineHeight: 1.5, wordBreak: "break-word" }}>{n.text}</div>}
                  {n.typ === "foto" && n.foto_url && (
                    <img src={n.foto_url} alt="Foto" style={{ maxWidth: 220, maxHeight: 200, borderRadius: 12, display: "block", cursor: "pointer" }}
                      onClick={() => window.open(n.foto_url)} onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  )}
                </div>
                <div style={{ fontSize: 9, color: "#bbb", marginTop: 2, display: "flex", gap: 4 }}>
                  {formatTime(n.created_at)}
                  {n.ki_verarbeitet && n.absender !== "Sascha" && <span style={{ color: "#9C27B0" }}>✦ übertragen</span>}
                </div>
              </div>
            </div>
          );
        })}

        {saschaTyping && (
          <div style={{ display: "flex", alignItems: "flex-end", gap: 6, padding: "4px 12px" }}>
            <div style={{ width: 30, height: 30, borderRadius: "50%", background: ACCENT, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>🤖</div>
            <div style={{ background: "#e8f8f5", borderRadius: "18px 18px 18px 4px", padding: "12px 16px", border: "1px solid " + ACCENT + "44" }}>
              <style>{`@keyframes bob{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-4px)}}`}</style>
              <div style={{ display: "flex", gap: 5 }}>
                {[0,1,2].map(i => <div key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: ACCENT, animation: `bob 1s ease-in-out ${i*0.2}s infinite` }} />)}
              </div>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      <div style={{ flexShrink: 0, padding: "8px 10px", background: "#fff", borderTop: "1px solid #f0f0f0", display: "flex", gap: 8, alignItems: "flex-end" }}>
        <label style={{ width: 40, height: 40, borderRadius: "50%", background: "#f0f4f3", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, fontSize: 18, opacity: fotoSending ? 0.5 : 1 }}>
          📸<input type="file" accept="image/*" capture="environment" multiple style={{ display: "none" }} onChange={e => e.target.files && sendFoto(e.target.files)} />
        </label>
        <label style={{ width: 40, height: 40, borderRadius: "50%", background: "#f0f4f3", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, fontSize: 18, opacity: fotoSending ? 0.5 : 1 }}>
          🖼<input type="file" accept="image/*" multiple style={{ display: "none" }} onChange={e => e.target.files && sendFoto(e.target.files)} />
        </label>
        <textarea value={text} onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendText(); } }}
          placeholder="Schreib Sascha..." rows={1}
          style={{ flex: 1, padding: "10px 14px", borderRadius: 22, border: "1.5px solid #e8eaed", background: "#f8f8f8", fontSize: 13, resize: "none", outline: "none", fontFamily: "system-ui", lineHeight: 1.4, maxHeight: 100, overflowY: "auto" }} />
        <button onClick={sendText} disabled={!text.trim() || sending}
          style={{ width: 42, height: 42, borderRadius: "50%", border: "none", background: text.trim() ? ACCENT : "#e8eaed", cursor: text.trim() ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>
          ➤
        </button>
      </div>
    </div>
  );
}
