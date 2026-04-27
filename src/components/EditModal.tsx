import { useRef } from "react";
import { C, ACCENT, BS_KAT, MA_KAT } from "../lib/constants";
import { ROLLEN_LABEL } from "../rollen";
import type { Rolle } from "../rollen";

function UField({ label, defaultValue, name, type }: any) {
  return (
    <div>
      <label style={C.lbl}>{label}</label>
      <input style={C.inp} name={name} type={type || "text"} defaultValue={defaultValue ?? ""} />
    </div>
  );
}

function USel({ label, defaultValue, name, opts, optLabels }: any) {
  return (
    <div>
      <label style={C.lbl}>{label}</label>
      <select style={C.inp} name={name} defaultValue={defaultValue ?? ""}>
        <option value="">-- wählen --</option>
        {opts.map((o: string, i: number) => (
          <option key={o} value={o}>{optLabels ? optLabels[i] : o}</option>
        ))}
      </select>
    </div>
  );
}

export function EditModal({ modalType, modalMode, initialForm, onSave, onClose }: any) {
  const formRef = useRef<HTMLFormElement>(null);
  const modalKey = modalType + "|" + modalMode + "|" + (initialForm.id || "new");
  const d = initialForm;
  const isMobile = window.innerWidth < 768;

  function handleSave() {
    const fd = new FormData(formRef.current!);
    const out = { ...initialForm };
    fd.forEach((val, key) => { out[key] = val; });
    onSave(out);
  }

  return (
    <div
      style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.4)",
        display: "flex",
        alignItems: isMobile ? "flex-end" : "center",
        justifyContent: "center",
        zIndex: 9999,
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        ...C.card,
        width: isMobile ? "100%" : "min(640px,95vw)",
        maxWidth: 640,
        maxHeight: isMobile ? "92vh" : "90vh",
        overflowY: "auto",
        border: "1px solid #eee",
        borderRadius: isMobile ? "20px 20px 0 0" : 16,
        margin: 0,
        padding: isMobile ? "20px 16px 32px" : 24,
        WebkitOverflowScrolling: "touch",
      } as any}>

        {/* Handle für Mobile */}
        {isMobile && (
          <div style={{ width: 40, height: 4, background: "#ddd", borderRadius: 2, margin: "0 auto 16px" }} />
        )}

        <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 16, paddingBottom: 12, borderBottom: "1px solid #f5f5f5", color: "#222" }}>
          {modalMode === "add" ? "Neu anlegen" : "Bearbeiten"}
          <span style={{ color: ACCENT, fontWeight: 500, fontSize: 14 }}> – {modalType}</span>
        </div>

        <form key={modalKey} ref={formRef}>

          {/* ── Mitarbeiter ─────────────────────────────────────────────────── */}
          {modalType === "mitarbeiter" && (
            <div>
              <div style={C.r2}><UField label="Name" name="name" defaultValue={d.name} /><UField label="Rolle" name="rolle" defaultValue={d.rolle} /></div>
              <div style={C.r2}><UField label="Telefon" name="telefon" defaultValue={d.telefon} /><UField label="Geburtsdatum" name="geburtsdatum" type="date" defaultValue={d.geburtsdatum} /></div>
              <UField label="Adresse" name="adresse" defaultValue={d.adresse} />
              <UField label="Notfallkontakt" name="notfallkontakt" defaultValue={d.notfallkontakt} />
              <div style={C.r3}>
                <UField label="Eintrittsdatum" name="eintrittsdatum" type="date" defaultValue={d.eintrittsdatum} />
                <UField label="Stundenlohn" name="stundenlohn" type="number" defaultValue={d.stundenlohn} />
                <USel label="Vertragsart" name="vertragsart" defaultValue={d.vertragsart} opts={["Vollzeit","Teilzeit","Minijob","Leiharbeiter"]} />
              </div>
              <div style={C.r2}><UField label="Urlaubstage" name="urlaubstage" type="number" defaultValue={d.urlaubstage} /><UField label="Urlaub genommen" name="urlaubGenommen" type="number" defaultValue={d.urlaubGenommen} /></div>
              <UField label="Qualifikationen (kommagetrennt)" name="qualifikationen" defaultValue={d.qualifikationen} />
              <UField label="Führerscheinklassen (kommagetrennt)" name="fuehrerschein" defaultValue={d.fuehrerschein} />
              <UField label="Zertifikate" name="zertifikate" defaultValue={d.zertifikate} />
              <div style={C.r2}>
                <USel label="Status" name="status" defaultValue={d.status} opts={["aktiv","verfügbar","krank","Urlaub","gekuendigt"]} />
                <USel label="Kategorie" name="kategorie" defaultValue={d.kategorie} opts={MA_KAT} />
              </div>
              <UField label="Aktuelle Baustelle" name="baustelle" defaultValue={d.baustelle} />
              <div style={C.r2}>
                <UField label="Gut mit (Namen kommagetrennt)" name="gutMit" defaultValue={d.gutMit} />
                <UField label="Nicht mit (Namen kommagetrennt)" name="nichtMit" defaultValue={d.nichtMit} />
              </div>
              <UField label="Bemerkungen" name="bemerkungen" defaultValue={d.bemerkungen} />

              {/* System-Zugang */}
              <div style={{ marginTop: 12, padding: "12px 14px", background: "#f8f8ff", borderRadius: 10, border: "1px solid #e8eaed" }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#555", marginBottom: 8 }}>🔐 System-Zugang</div>
                <div style={C.r2}>
                  <USel label="System-Rolle" name="rolle_system" defaultValue={d.rolle_system} opts={Object.keys(ROLLEN_LABEL)} optLabels={Object.values(ROLLEN_LABEL)} />
                 <UField label="Passwort (min. 10 Zeichen)" name="pin" type="password" defaultValue={d.pin} />
                </div>
                <div style={{ fontSize: 11, color: "#aaa", marginTop: 4 }}>Nur ausfüllen wenn die Person Zugang zur App haben soll.</div>
              </div>
            </div>
          )}

          {/* ── Baustellen ──────────────────────────────────────────────────── */}
          {modalType === "baustellen" && (
            <div>
              <div style={C.r2}><UField label="Name" name="name" defaultValue={d.name} /><UField label="Adresse / Ort" name="ort" defaultValue={d.ort} /></div>
              <UField label="Beschreibung" name="beschreibung" defaultValue={d.beschreibung} />
              <div style={C.r2}>
                <USel label="Kategorie" name="kategorie" defaultValue={d.kategorie} opts={BS_KAT} />
                <USel label="Status" name="status" defaultValue={d.status} opts={["geplant","laufend","abgeschlossen"]} />
              </div>
              <UField label="Anforderungen (kommagetrennt)" name="anforderungen" defaultValue={d.anforderungen} />
              <div style={C.r2}><UField label="Start" name="start" type="date" defaultValue={d.start} /><UField label="Ende" name="ende" type="date" defaultValue={d.ende} /></div>
            </div>
          )}

          {/* ── Lager ───────────────────────────────────────────────────────── */}
          {modalType === "lager" && (
            <div>
              <div style={C.r2}>
                <UField label="Artikel" name="name" defaultValue={d.name} />
                <USel label="Kategorie" name="kategorie" defaultValue={d.kategorie} opts={["Maschine","Werkzeug","PSA","Material","Fahrzeugteile"]} />
              </div>
              <div style={C.r3}>
                <UField label="Gesamt" name="anzahl" type="number" defaultValue={d.anzahl} />
                <UField label="Verfügbar" name="verfuegbar" type="number" defaultValue={d.verfuegbar} />
                <UField label="Mindestbestand" name="mindestbestand" type="number" defaultValue={d.mindestbestand} />
              </div>
              <UField label="Zugewiesen an" name="zugewiesen" defaultValue={d.zugewiesen} />
            </div>
          )}

          {/* ── Fahrzeuge ───────────────────────────────────────────────────── */}
          {modalType === "fahrzeuge" && (
            <div>
              <div style={C.r2}>
                <UField label="Name" name="name" defaultValue={d.name} />
                <USel label="Typ" name="typ" defaultValue={d.typ} opts={["LKW","Bagger","Transporter","Kran","PKW"]} />
              </div>
              <div style={C.r2}>
                <UField label="Kennzeichen" name="kennzeichen" defaultValue={d.kennzeichen} />
                <USel label="Status" name="status" defaultValue={d.status} opts={["verfügbar","im Einsatz","Wartung","defekt"]} />
              </div>
              <div style={C.r2}><UField label="Baustelle" name="baustelle" defaultValue={d.baustelle} /><UField label="Fahrer" name="fahrer" defaultValue={d.fahrer} /></div>
              <UField label="Aufgabe" name="aufgabe" defaultValue={d.aufgabe} />
              <UField label="Frei ab" name="freiAb" defaultValue={d.freiAb} />
            </div>
          )}
        </form>

        {/* Buttons */}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 20 }}>
          <button style={{ ...C.btnS, flex: isMobile ? 1 : "none", padding: isMobile ? "12px" : undefined }} onClick={onClose}>Abbrechen</button>
          <button style={{ ...C.btnP, flex: isMobile ? 1 : "none", padding: isMobile ? "12px" : undefined }} onClick={handleSave}>Speichern</button>
        </div>
      </div>
    </div>
  );
}
