import { useState } from "react";
import { C, ACCENT, BS_KAT } from "../lib/constants";
import { getProgress, pill } from "../lib/utils";
import { supabase } from "../lib/supabase";
import { AufgabenPanel } from "../components/Kalender";

export function BaustellenTab({ data, setData, openAdd, openEdit, deleteItem, selectedBS, setSelectedBS }: any) {

  const [expId, setExpId] = useState<number|null>(selectedBS || null);

  // ── Mitarbeiter zuweisen ────────────────────────────────────────────────────
  const assignMA = async (bsId: number, maId: number) => {
    const bs  = data.baustellen.find((b: any) => b.id === bsId);
    const was = bs.mitarbeiter.includes(maId);
    const nm  = bs.name;

    // Neue Mitarbeiter-Liste für die Baustelle
    const neuListe = was
      ? bs.mitarbeiter.filter((i: number) => i !== maId)
      : [...bs.mitarbeiter, maId];

    // 1. Baustellen-Mitarbeiter in Supabase speichern
    await supabase.from("baustellen").update({ mitarbeiter: neuListe }).eq("id", bsId);

    // 2. Mitarbeiter.baustelle in Supabase speichern
    await supabase.from("mitarbeiter").update({ baustelle: was ? "" : nm }).eq("id", maId);

    // 3. Lokalen State aktualisieren
    setData((d: any) => ({
      ...d,
      baustellen: d.baustellen.map((b: any) =>
        b.id !== bsId ? b : { ...b, mitarbeiter: neuListe }
      ),
      mitarbeiter: d.mitarbeiter.map((m: any) =>
        m.id !== maId ? m : { ...m, baustelle: was ? "" : nm }
      ),
    }));
  };

  // ── Fahrzeug zuweisen ───────────────────────────────────────────────────────
  const assignFZ = async (bsId: number, fzId: number) => {
    const bs  = data.baustellen.find((b: any) => b.id === bsId);
    const fz  = bs.fahrzeuge || [];
    const was = fz.includes(fzId);
    const nm  = bs.name;

    const neuListe = was
      ? fz.filter((i: number) => i !== fzId)
      : [...fz, fzId];

    // 1. Baustellen-Fahrzeuge in Supabase speichern
    await supabase.from("baustellen").update({ fahrzeuge: neuListe }).eq("id", bsId);

    // 2. Fahrzeug-Status in Supabase speichern
    await supabase.from("fahrzeuge").update({
      baustelle: was ? "" : nm,
      status: was ? "verfügbar" : "im Einsatz"
    }).eq("id", fzId);

    // 3. Lokalen State aktualisieren
    setData((d: any) => ({
      ...d,
      baustellen: d.baustellen.map((b: any) =>
        b.id !== bsId ? b : { ...b, fahrzeuge: neuListe }
      ),
      fahrzeuge: d.fahrzeuge.map((f: any) =>
        f.id !== fzId ? f : { ...f, baustelle: was ? "" : nm, status: was ? "verfügbar" : "im Einsatz" }
      ),
    }));
  };

  // ── Equipment zuweisen + Lagerbestand aktualisieren ────────────────────────
  const assignEQ = async (bsId: number, lgId: number) => {
    const bs  = data.baustellen.find((b: any) => b.id === bsId);
    const eq  = bs.equipment || [];
    const was = eq.includes(lgId);

    const neuListe = was
      ? eq.filter((i: number) => i !== lgId)
      : [...eq, lgId];

    // Lagerbestand berechnen
    const lager = data.lager.find((l: any) => l.id === lgId);
    const neuVerfuegbar = was
      ? Math.min(lager.anzahl, (lager.verfuegbar || 0) + 1)
      : Math.max(0, (lager.verfuegbar || 0) - 1);

    // 1. Baustellen-Equipment in Supabase speichern
    await supabase.from("baustellen").update({ equipment: neuListe }).eq("id", bsId);

    // 2. Lagerbestand in Supabase speichern
    await supabase.from("lager").update({ verfuegbar: neuVerfuegbar }).eq("id", lgId);

    // 3. Lokalen State aktualisieren
    setData((d: any) => ({
      ...d,
      baustellen: d.baustellen.map((b: any) =>
        b.id !== bsId ? b : { ...b, equipment: neuListe }
      ),
      lager: d.lager.map((l: any) =>
        l.id !== lgId ? l : { ...l, verfuegbar: neuVerfuegbar }
      ),
    }));
  };

  // ── Baustellen filtern ──────────────────────────────────────────────────────
  const anzeigeBS = selectedBS
    ? data.baustellen.filter((b: any) => b.id === selectedBS)
    : data.baustellen;

  const bsGruppen = BS_KAT.map(k => ({
    key: k,
    members: anzeigeBS.filter((b: any) =>
      k === "Sonstiges"
        ? !["Tiefbau", "LSA", "Straße"].includes(b.kategorie) || !b.kategorie
        : b.kategorie === k
    ),
  })).filter(g => g.members.length > 0);

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          {selectedBS && (
            <button
              onClick={() => { setSelectedBS(null); setExpId(null); }}
              style={{ padding: "6px 14px", borderRadius: 8, border: "1.5px solid #e8eaed", background: "#fff", cursor: "pointer", fontSize: 12, color: "#555", display: "flex", alignItems: "center", gap: 6 }}
            >
              ← Alle Baustellen
            </button>
          )}
        </div>
        <button style={C.btnP} onClick={() => openAdd("baustellen")}>+ Neue Baustelle</button>
      </div>

      {/* Baustellen Gruppen */}
      {bsGruppen.map(g => (
        <div key={g.key} style={{ ...C.card, marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: "#222" }}>{g.key}</span>
            <span style={{ fontSize: 11, color: "#bbb", background: "#f5f5f5", padding: "2px 8px", borderRadius: 20 }}>{g.members.length}</span>
          </div>

          {g.members.map((b: any) => {
            const isExp = expId === b.id;
            const prog  = getProgress(b);
            const aMA   = b.mitarbeiter.map((id: number) => data.mitarbeiter.find((m: any) => m.id === id)).filter(Boolean);
            const aFZ   = (b.fahrzeuge || []).map((id: number) => data.fahrzeuge.find((f: any) => f.id === id)).filter(Boolean);
            const aEQ   = (b.equipment || []).map((id: number) => data.lager.find((l: any) => l.id === id)).filter(Boolean);
            const avMA  = data.mitarbeiter.filter((m: any) => !b.mitarbeiter.includes(m.id));
            const avFZ  = data.fahrzeuge.filter((f: any) => !(b.fahrzeuge || []).includes(f.id));
            const avEQ  = data.lager.filter((l: any) => !(b.equipment || []).includes(l.id) && (l.verfuegbar || 0) > 0);
            const dl    = b.ende ? Math.ceil((new Date(b.ende).getTime() - Date.now()) / 86400000) : null;

            return (
              <div key={b.id} style={{ background: "#f8fffe", borderRadius: 12, border: "1px solid #e8f5f3", marginBottom: 10, overflow: "hidden" }}>

                {/* Baustellen-Kopf */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto", alignItems: "center", padding: "14px 16px", gap: 12 }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14, color: "#222" }}>
                      {b.name}
                      <span style={{ fontWeight: 400, fontSize: 12, color: "#aaa", marginLeft: 6 }}>– {b.ort}</span>
                    </div>
                    <div style={{ fontSize: 11, color: "#bbb", marginTop: 2 }}>{b.beschreibung}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                      <div style={{ flex: 1, height: 6, background: "#e0e0e0", borderRadius: 3 }}>
                        <div style={{ height: "100%", width: prog + "%", background: ACCENT, borderRadius: 3, transition: "width 0.3s" }} />
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: ACCENT, minWidth: 32 }}>{prog}%</span>
                      <span style={pill(b.status, true)}>{b.status}</span>
                      {dl !== null && !isNaN(dl) && (
                        <span style={{ fontSize: 11, color: dl <= 14 ? "#E24B4A" : "#bbb" }}>{dl}d</span>
                      )}
                      <span style={{ fontSize: 11, color: "#bbb" }}>{aMA.length}MA {aFZ.length}Fzg</span>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      style={{ padding: "6px 12px", borderRadius: 10, border: "1.5px solid " + (isExp ? ACCENT : "#eee"), background: isExp ? "#e8f5f3" : "#fff", cursor: "pointer", fontSize: 12, color: isExp ? ACCENT : "#555" }}
                      onClick={() => setExpId(isExp ? null : b.id)}
                    >
                      Zuweisen
                    </button>
                    <button
                      style={{ padding: "6px 10px", borderRadius: 10, border: "1.5px solid #eee", background: "#fff", cursor: "pointer", fontSize: 12, color: "#555" }}
                      onClick={() => openEdit("baustellen", b)}
                    >✎</button>
                    <button
                      style={{ padding: "6px 10px", borderRadius: 10, border: "none", background: "#E24B4A18", cursor: "pointer", fontSize: 12, color: "#E24B4A" }}
                      onClick={() => deleteItem("baustellen", b.id)}
                    >✕</button>
                  </div>
                </div>

                {/* Aufgaben + Zuweisung */}
                {isExp && (
                  <div>
                    <AufgabenPanel baustelle={b} setData={setData} />

                    <div style={{ borderTop: "1px solid #e8f5f3", padding: "14px 16px", background: "#fff", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
                      {[
                        { title: "Mitarbeiter", aList: aMA, avList: avMA, fn: (id: number) => assignMA(b.id, id), getName: (x: any) => x.name, getSub: (x: any) => x.rolle, ac: "#1D9E75" },
                        { title: "Fahrzeuge",   aList: aFZ, avList: avFZ, fn: (id: number) => assignFZ(b.id, id), getName: (x: any) => x.name, getSub: (x: any) => x.kennzeichen, ac: "#378ADD" },
                        { title: "Equipment",   aList: aEQ, avList: avEQ, fn: (id: number) => assignEQ(b.id, id), getName: (x: any) => x.name, getSub: (x: any) => `${x.verfuegbar}/${x.anzahl} verfügbar`, ac: "#BA7517" },
                      ].map(col => (
                        <div key={col.title}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: "#555", marginBottom: 8 }}>{col.title}</div>

                          {/* Zugewiesene */}
                          {col.aList.map((x: any) => (
                            <div key={x.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 8px", background: "#f8fffe", borderRadius: 8, marginBottom: 4, border: "1px solid #e8f5f3" }}>
                              <div>
                                <div style={{ fontSize: 12, fontWeight: 500 }}>{col.getName(x)}</div>
                                <div style={{ fontSize: 10, color: "#bbb" }}>{col.getSub(x)}</div>
                              </div>
                              <button onClick={() => col.fn(x.id)} style={{ background: "#E24B4A18", border: "none", color: "#E24B4A", borderRadius: 6, padding: "2px 7px", cursor: "pointer", fontSize: 11 }}>–</button>
                            </div>
                          ))}
                          {col.aList.length === 0 && <div style={{ fontSize: 11, color: "#bbb", marginBottom: 6 }}>Keine</div>}

                          {/* Verfügbare */}
                          <div style={{ maxHeight: 140, overflowY: "auto", display: "flex", flexDirection: "column", gap: 3 }}>
                            {col.avList.map((x: any) => (
                              <div key={x.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 8px", background: "#fff", borderRadius: 8, border: "1px solid #eee" }}>
                                <div style={{ fontSize: 11 }}>{col.getName(x)}</div>
                                <button onClick={() => col.fn(x.id)} style={{ background: col.ac + "22", border: "none", color: col.ac, borderRadius: 6, padding: "2px 7px", cursor: "pointer", fontSize: 11 }}>+</button>
                              </div>
                            ))}
                            {col.avList.length === 0 && <div style={{ fontSize: 10, color: "#ccc", fontStyle: "italic" }}>Nichts verfügbar</div>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
