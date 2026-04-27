import { useState } from "react";
import { C, ACCENT, BS_KAT } from "../lib/constants";
import { getProgress, pill } from "../lib/utils";
import { supabase } from "../lib/supabase";
import { AufgabenPanel } from "../components/Kalender";

const toNumArr = (arr: any[]): number[] => arr.map((i: any) => Number(i)).filter((i: number) => !isNaN(i));

export function BaustellenTab({ data, setData, openAdd, openEdit, deleteItem, selectedBS, setSelectedBS, rolle, kannBaustellenAnlegen }: any) {

  const [expId, setExpId] = useState<number|null>(selectedBS || null);
  const isBauleitung = rolle === "baustellen_leitung";

  // ── Mitarbeiter zuweisen ────────────────────────────────────────────────────
  const assignMA = async (bsId: number, maId: number) => {
    const bs       = data.baustellen.find((b: any) => b.id === bsId);
    const liste    = toNumArr(bs.mitarbeiter || []);
    const was      = liste.includes(maId);
    const neuListe = was ? liste.filter(i => i !== maId) : [...liste, maId];
    const nm       = bs.name;

    await supabase.from("baustellen").update({ mitarbeiter: neuListe }).eq("id", bsId);
    await supabase.from("mitarbeiter").update({ baustelle: was ? "" : nm }).eq("id", maId);

    setData((d: any) => ({
      ...d,
      baustellen: d.baustellen.map((b: any) => b.id !== bsId ? b : { ...b, mitarbeiter: neuListe }),
      mitarbeiter: d.mitarbeiter.map((m: any) => m.id !== maId ? m : { ...m, baustelle: was ? "" : nm }),
    }));
  };

  // ── Fahrzeug zuweisen ───────────────────────────────────────────────────────
  const assignFZ = async (bsId: number, fzId: number) => {
    const bs       = data.baustellen.find((b: any) => b.id === bsId);
    const liste    = toNumArr(bs.fahrzeuge || []);
    const was      = liste.includes(fzId);
    const neuListe = was ? liste.filter(i => i !== fzId) : [...liste, fzId];
    const nm       = bs.name;

    await supabase.from("baustellen").update({ fahrzeuge: neuListe }).eq("id", bsId);
    await supabase.from("fahrzeuge").update({ baustelle: was ? "" : nm, status: was ? "verfügbar" : "im Einsatz" }).eq("id", fzId);

    setData((d: any) => ({
      ...d,
      baustellen: d.baustellen.map((b: any) => b.id !== bsId ? b : { ...b, fahrzeuge: neuListe }),
      fahrzeuge: d.fahrzeuge.map((f: any) => f.id !== fzId ? f : { ...f, baustelle: was ? "" : nm, status: was ? "verfügbar" : "im Einsatz" }),
    }));
  };

  // ── Equipment zuweisen ──────────────────────────────────────────────────────
  const assignEQ = async (bsId: number, lgId: number) => {
    const bs       = data.baustellen.find((b: any) => b.id === bsId);
    const liste    = toNumArr(bs.equipment || []);
    const was      = liste.includes(lgId);
    const neuListe = was ? liste.filter(i => i !== lgId) : [...liste, lgId];
    const lager    = data.lager.find((l: any) => l.id === lgId);
    const neuVerfuegbar = was
      ? Math.min(lager.anzahl, (lager.verfuegbar || 0) + 1)
      : Math.max(0, (lager.verfuegbar || 0) - 1);

    await supabase.from("baustellen").update({ equipment: neuListe }).eq("id", bsId);
    await supabase.from("lager").update({ verfuegbar: neuVerfuegbar }).eq("id", lgId);

    setData((d: any) => ({
      ...d,
      baustellen: d.baustellen.map((b: any) => b.id !== bsId ? b : { ...b, equipment: neuListe }),
      lager: d.lager.map((l: any) => l.id !== lgId ? l : { ...l, verfuegbar: neuVerfuegbar }),
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

  // Zuweisungs-Spalten je nach Rolle
  const getKolumnen = (b: any) => {
    const maIds = toNumArr(b.mitarbeiter || []);
    const fzIds = toNumArr(b.fahrzeuge   || []);
    const eqIds = toNumArr(b.equipment   || []);
    const aMA   = maIds.map((id: number) => data.mitarbeiter.find((m: any) => m.id === id)).filter(Boolean);
    const aFZ   = fzIds.map((id: number) => data.fahrzeuge.find((f: any) => f.id === id)).filter(Boolean);
    const aEQ   = eqIds.map((id: number) => data.lager.find((l: any) => l.id === id)).filter(Boolean);
    const avMA  = data.mitarbeiter.filter((m: any) => !maIds.includes(m.id));
    const avFZ  = data.fahrzeuge.filter((f: any) => !fzIds.includes(f.id));
    const avEQ  = data.lager.filter((l: any) => !eqIds.includes(l.id) && (l.verfuegbar || 0) > 0);

    // Bauleitung sieht nur Equipment
    if (isBauleitung) {
      return [
        { title: "Equipment", aList: aEQ, avList: avEQ, fn: (id: number) => assignEQ(b.id, id), getName: (x: any) => x.name, getSub: (x: any) => `${x.verfuegbar}/${x.anzahl} verfügbar`, ac: "#BA7517" },
      ];
    }

    // Alle anderen sehen alles
    return [
      { title: "Mitarbeiter", aList: aMA, avList: avMA, fn: (id: number) => assignMA(b.id, id), getName: (x: any) => x.name, getSub: (x: any) => x.rolle, ac: "#1D9E75" },
      { title: "Fahrzeuge",   aList: aFZ, avList: avFZ, fn: (id: number) => assignFZ(b.id, id), getName: (x: any) => x.name, getSub: (x: any) => x.kennzeichen, ac: "#378ADD" },
      { title: "Equipment",   aList: aEQ, avList: avEQ, fn: (id: number) => assignEQ(b.id, id), getName: (x: any) => x.name, getSub: (x: any) => `${x.verfuegbar}/${x.anzahl} verfügbar`, ac: "#BA7517" },
    ];
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          {selectedBS && (
            <button onClick={() => { setSelectedBS(null); setExpId(null); }}
              style={{ padding: "6px 14px", borderRadius: 8, border: "1.5px solid #e8eaed", background: "#fff", cursor: "pointer", fontSize: 12, color: "#555", display: "flex", alignItems: "center", gap: 6 }}>
              ← Alle Baustellen
            </button>
          )}
        </div>
        {/* Bauleitung kann keine neuen Baustellen anlegen */}
        {!isBauleitung && (
          <button style={C.btnP} onClick={() => openAdd("baustellen")}>+ Neue Baustelle</button>
        )}
      </div>

      {/* Baustellen Gruppen */}
      {bsGruppen.map(g => (
        <div key={g.key} style={{ ...C.card, marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: "#222" }}>{g.key}</span>
            <span style={{ fontSize: 11, color: "#bbb", background: "#f5f5f5", padding: "2px 8px", borderRadius: 20 }}>{g.members.length}</span>
          </div>

          {g.members.map((b: any) => {
            const isExp  = expId === b.id;
            const prog   = getProgress(b);
            const maIds  = toNumArr(b.mitarbeiter || []);
            const fzIds  = toNumArr(b.fahrzeuge   || []);
            const aMA    = maIds.map((id: number) => data.mitarbeiter.find((m: any) => m.id === id)).filter(Boolean);
            const aFZ    = fzIds.map((id: number) => data.fahrzeuge.find((f: any) => f.id === id)).filter(Boolean);
            const dl     = b.ende ? Math.ceil((new Date(b.ende).getTime() - Date.now()) / 86400000) : null;
            const kolumnen = getKolumnen(b);

            return (
              <div key={b.id} style={{ background: "#f8fffe", borderRadius: 12, border: "1px solid #e8f5f3", marginBottom: 10, overflow: "hidden" }}>

                {/* Kopf */}
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
                      {dl !== null && !isNaN(dl) && <span style={{ fontSize: 11, color: dl <= 14 ? "#E24B4A" : "#bbb" }}>{dl}d</span>}
                      <span style={{ fontSize: 11, color: "#bbb" }}>{aMA.length}MA {aFZ.length}Fzg</span>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      style={{ padding: "6px 12px", borderRadius: 10, border: "1.5px solid " + (isExp ? ACCENT : "#eee"), background: isExp ? "#e8f5f3" : "#fff", cursor: "pointer", fontSize: 12, color: isExp ? ACCENT : "#555" }}
                      onClick={() => setExpId(isExp ? null : b.id)}
                    >
                      {isBauleitung ? "Equipment" : "Zuweisen"}
                    </button>
                    {/* Bauleitung kann nicht bearbeiten oder löschen */}
                    {!isBauleitung && (
                      <>
                        <button style={{ padding: "6px 10px", borderRadius: 10, border: "1.5px solid #eee", background: "#fff", cursor: "pointer", fontSize: 12, color: "#555" }} onClick={() => openEdit("baustellen", b)}>✎</button>
                        <button style={{ padding: "6px 10px", borderRadius: 10, border: "none", background: "#E24B4A18", cursor: "pointer", fontSize: 12, color: "#E24B4A" }} onClick={() => deleteItem("baustellen", b.id)}>✕</button>
                      </>
                    )}
                  </div>
                </div>

                {/* Aufgaben + Zuweisung */}
                {isExp && (
                  <div>
                    <AufgabenPanel baustelle={b} setData={setData} />
                    <div style={{ borderTop: "1px solid #e8f5f3", padding: "14px 16px", background: "#fff", display: "grid", gridTemplateColumns: kolumnen.length === 1 ? "1fr" : "1fr 1fr 1fr", gap: 16 }}>
                      {kolumnen.map(col => (
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
                          <div style={{ maxHeight: 160, overflowY: "auto", display: "flex", flexDirection: "column", gap: 3 }}>
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
