import { useState } from "react";
import { C, ACCENT, BS_KAT } from "../../lib/constants";
import { supabase } from "../../lib/supabase";
import { BaustellenKarte } from "./BaustellenKarte";
import { NeuerBaustellenDialog } from "./NeuerBaustellenDialog";

const toNumArr = (arr: any[]): number[] =>
  (Array.isArray(arr) ? arr : []).map((i: any) => Number(i)).filter((i: number) => !isNaN(i));

export function BaustellenTab({ data, setData, openEdit, deleteItem, selectedBS, setSelectedBS, rolle, currentUser, isMobile }: any) {
  const [expId,   setExpId]   = useState<number | null>(null);
  const [showNeu, setShowNeu] = useState(false);
  const isBauleitung = rolle === "baustellen_leitung";

  // ── Zuweisungen ───────────────────────────────────────────────────────────────
  const assignMA = async (bsId: number, maId: number) => {
    const bs = data.baustellen.find((b: any) => b.id === bsId);
    const liste = toNumArr(bs.mitarbeiter);
    const was = liste.includes(maId);
    const neu = was ? liste.filter((i: number) => i !== maId) : [...liste, maId];
    await supabase.from("baustellen").update({ mitarbeiter: neu }).eq("id", bsId);
    await supabase.from("mitarbeiter").update({ baustelle: was ? "" : bs.name }).eq("id", maId);
    setData((d: any) => ({
      ...d,
      baustellen: d.baustellen.map((b: any) => b.id !== bsId ? b : { ...b, mitarbeiter: neu }),
      mitarbeiter: d.mitarbeiter.map((m: any) => m.id !== maId ? m : { ...m, baustelle: was ? "" : bs.name }),
    }));
  };

  const assignFZ = async (bsId: number, fzId: number) => {
    const bs = data.baustellen.find((b: any) => b.id === bsId);
    const liste = toNumArr(bs.fahrzeuge);
    const was = liste.includes(fzId);
    const neu = was ? liste.filter((i: number) => i !== fzId) : [...liste, fzId];
    await supabase.from("baustellen").update({ fahrzeuge: neu }).eq("id", bsId);
    await supabase.from("fahrzeuge").update({ baustelle: was ? "" : bs.name, status: was ? "verfügbar" : "im Einsatz" }).eq("id", fzId);
    setData((d: any) => ({
      ...d,
      baustellen: d.baustellen.map((b: any) => b.id !== bsId ? b : { ...b, fahrzeuge: neu }),
      fahrzeuge: d.fahrzeuge.map((f: any) => f.id !== fzId ? f : { ...f, baustelle: was ? "" : bs.name, status: was ? "verfügbar" : "im Einsatz" }),
    }));
  };

  const assignEQ = async (bsId: number, lgId: number) => {
    const bs = data.baustellen.find((b: any) => b.id === bsId);
    const liste = toNumArr(bs.equipment);
    const was = liste.includes(lgId);
    const neu = was ? liste.filter((i: number) => i !== lgId) : [...liste, lgId];
    const lager = data.lager.find((l: any) => l.id === lgId);
    const neuV = was ? Math.min(lager.anzahl, (lager.verfuegbar || 0) + 1) : Math.max(0, (lager.verfuegbar || 0) - 1);
    await supabase.from("baustellen").update({ equipment: neu }).eq("id", bsId);
    await supabase.from("lager").update({ verfuegbar: neuV }).eq("id", lgId);
    setData((d: any) => ({
      ...d,
      baustellen: d.baustellen.map((b: any) => b.id !== bsId ? b : { ...b, equipment: neu }),
      lager: d.lager.map((l: any) => l.id !== lgId ? l : { ...l, verfuegbar: neuV }),
    }));
  };

  // ── Neue Baustelle ────────────────────────────────────────────────────────────
  async function speichernNeu(formData: any) {
    const { data: neu } = await supabase.from("baustellen").insert([formData]).select();
    if (neu?.[0]) {
      const fixed = {
        ...neu[0],
        mitarbeiter: [], fahrzeuge: [], equipment: [],
        aufgaben: Array.isArray(neu[0].aufgaben) ? neu[0].aufgaben : [],
        anforderungen: Array.isArray(neu[0].anforderungen) ? neu[0].anforderungen : [],
      };
      setData((d: any) => ({ ...d, baustellen: [...d.baustellen, fixed] }));
      // Geocoding
      if (formData.ort) {
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(formData.ort)}&format=json&limit=1`, { headers: { "Accept-Language": "de" } });
          const geo = await res.json();
          if (geo?.[0]) {
            const lat = parseFloat(geo[0].lat), lng = parseFloat(geo[0].lon);
            await supabase.from("baustellen").update({ lat, lng }).eq("id", neu[0].id);
            setData((d: any) => ({ ...d, baustellen: d.baustellen.map((b: any) => b.id === neu[0].id ? { ...b, lat, lng } : b) }));
          }
        } catch { /* ignorieren */ }
      }
    }
    setShowNeu(false);
  }

  // ── Filtern ───────────────────────────────────────────────────────────────────
  const anzeigeBS = isBauleitung
    ? data.baustellen.filter((b: any) => toNumArr(b.mitarbeiter).includes(Number(currentUser?.id)))
    : selectedBS
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
            <button onClick={() => { setSelectedBS(null); setExpId(null); }}
              style={{ padding: "6px 14px", borderRadius: 8, border: "1.5px solid #e8eaed", background: "#fff", cursor: "pointer", fontSize: 12, color: "#555" }}>
              ← Alle Baustellen
            </button>
          )}
        </div>
        {!isBauleitung && (
          <button style={C.btnP} onClick={() => setShowNeu(true)}>+ Neue Baustelle</button>
        )}
      </div>

      {/* Gruppen */}
      {bsGruppen.map(g => (
        <div key={g.key} style={{ ...C.card, marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: "#222" }}>{g.key}</span>
            <span style={{ fontSize: 11, color: "#bbb", background: "#f5f5f5", padding: "2px 8px", borderRadius: 20 }}>{g.members.length}</span>
          </div>
          {g.members.map((b: any) => {
            const maIds = toNumArr(b.mitarbeiter);
            const fzIds = toNumArr(b.fahrzeuge);
            const eqIds = toNumArr(b.equipment);
            const aMA = maIds.map((id: number) => data.mitarbeiter.find((m: any) => m.id === id)).filter(Boolean);
            const aFZ = fzIds.map((id: number) => data.fahrzeuge.find((f: any) => f.id === id)).filter(Boolean);
            const aEQ = eqIds.map((id: number) => data.lager.find((l: any) => l.id === id)).filter(Boolean);
            const avMA = data.mitarbeiter.filter((m: any) => !maIds.includes(m.id));
            const avFZ = data.fahrzeuge.filter((f: any) => !fzIds.includes(f.id));
            const avEQ = data.lager.filter((l: any) => !eqIds.includes(l.id) && (l.verfuegbar || 0) > 0);

            const kolumnen = isBauleitung
              ? [{ title: "Equipment", aList: aEQ, avList: avEQ, fn: (id: number) => assignEQ(b.id, id), getName: (x: any) => x.name, getSub: (x: any) => `${x.verfuegbar}/${x.anzahl} verfügbar`, ac: "#BA7517" }]
              : [
                  { title: "Mitarbeiter", aList: aMA, avList: avMA, fn: (id: number) => assignMA(b.id, id), getName: (x: any) => x.name, getSub: (x: any) => x.rolle, ac: "#1D9E75" },
                  { title: "Fahrzeuge",   aList: aFZ, avList: avFZ, fn: (id: number) => assignFZ(b.id, id), getName: (x: any) => x.name, getSub: (x: any) => x.kennzeichen, ac: "#378ADD" },
                  { title: "Equipment",   aList: aEQ, avList: avEQ, fn: (id: number) => assignEQ(b.id, id), getName: (x: any) => x.name, getSub: (x: any) => `${x.verfuegbar}/${x.anzahl} verfügbar`, ac: "#BA7517" },
                ];

            return (
              <BaustellenKarte
                key={b.id}
                b={b}
                data={data}
                setData={setData}
                isExp={expId === b.id}
                onToggleExp={() => setExpId(expId === b.id ? null : b.id)}
                onEdit={() => openEdit("baustellen", b)}
                onDelete={() => deleteItem("baustellen", b.id)}
                isBauleitung={isBauleitung}
                kolumnen={kolumnen}
              />
            );
          })}
        </div>
      ))}

      {bsGruppen.length === 0 && (
        <div style={{ ...C.card, textAlign: "center", padding: 40, color: "#bbb" }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>⛏</div>
          <div style={{ fontSize: 14 }}>Keine Baustellen vorhanden</div>
          {!isBauleitung && <div style={{ fontSize: 12, marginTop: 8 }}>Klicke "+ Neue Baustelle" um loszulegen</div>}
        </div>
      )}

      {showNeu && (
        <NeuerBaustellenDialog
          onSave={speichernNeu}
          onClose={() => setShowNeu(false)}
          isMobile={!!isMobile}
        />
      )}
    </div>
  );
}
