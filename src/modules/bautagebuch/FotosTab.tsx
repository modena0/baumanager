import { useState } from "react";
import { C, ACCENT } from "../../lib/constants";
import { supabase } from "../../lib/supabase";

const FOTO_TYPEN = ["allgemein", "Material", "Lieferschein", "Einbauort", "Schaden", "Abnahme"];

export function FotosTab({ bsId, datum, eintragId, fotos, setFotos, currentUser, isMobile }: any) {
  const [selectedTyp, setSelectedTyp] = useState<string | null>(null);
  const [uploading,   setUploading]   = useState(false);
  const [lightbox,    setLightbox]    = useState<any>(null);

  async function hochladen(files: FileList, typ: string) {
    if (!files.length) return;
    setUploading(true);

    for (const file of Array.from(files)) {
      // Storage versuchen
      const fileName = `bautagebuch/${bsId}/${datum}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
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
              const max = 800;
              if (w > max) { h = h * max / w; w = max; }
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

      const foto: any = { baustelle_id: bsId, datum, url, typ, erstellt_von: currentUser?.name || "" };
      if (eintragId) foto.eintrag_id = eintragId;
      const { data: neu } = await supabase.from("bautagebuch_fotos").insert([foto]).select().single();
      if (neu) setFotos((fs: any[]) => [...fs, { ...foto, id: neu.id }]);
    }
    setUploading(false);
    setSelectedTyp(null);
  }

  async function deleteFoto(id: number) {
    await supabase.from("bautagebuch_fotos").delete().eq("id", id);
    setFotos((fs: any[]) => fs.filter(f => f.id !== id));
  }

  return (
    <div>
      {/* Upload Bereich */}
      <div style={{ ...C.card, marginBottom: 16, padding: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#222", marginBottom: 10 }}>📷 Fotos hochladen</div>
        <div style={{ fontSize: 11, color: "#888", marginBottom: 8 }}>1. Kategorie wählen:</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
          {FOTO_TYPEN.map(typ => (
            <button key={typ} onClick={() => setSelectedTyp(selectedTyp === typ ? null : typ)}
              style={{ padding: "6px 12px", borderRadius: 10, border: "1.5px solid " + (selectedTyp === typ ? ACCENT : "#eee"), background: selectedTyp === typ ? "#e8f5f3" : "#fff", color: selectedTyp === typ ? ACCENT : "#555", cursor: "pointer", fontSize: 12, fontWeight: selectedTyp === typ ? 600 : 400 }}>
              {typ}
            </button>
          ))}
        </div>

        {selectedTyp && (
          <>
            <div style={{ fontSize: 11, color: "#888", marginBottom: 8 }}>2. Fotos auswählen (mehrere möglich):</div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <label style={{ ...C.btnP, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, opacity: uploading ? 0.6 : 1 }}>
                📸 Kamera
                <input type="file" accept="image/*" capture="environment" multiple style={{ display: "none" }} onChange={e => e.target.files && hochladen(e.target.files, selectedTyp)} />
              </label>
              <label style={{ ...C.btnS, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, opacity: uploading ? 0.6 : 1 }}>
                🖼 Aus Galerie
                <input type="file" accept="image/*" multiple style={{ display: "none" }} onChange={e => e.target.files && hochladen(e.target.files, selectedTyp)} />
              </label>
            </div>
            {uploading && <div style={{ fontSize: 12, color: ACCENT, marginTop: 8 }}>⏳ Lädt hoch...</div>}
          </>
        )}
      </div>

      {/* Galerie */}
      {fotos.length === 0 ? (
        <div style={{ ...C.card, textAlign: "center", padding: 32, color: "#bbb" }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📷</div>
          Noch keine Fotos für heute
        </div>
      ) : (
        FOTO_TYPEN.filter(typ => fotos.some((f: any) => f.typ === typ)).map(typ => (
          <div key={typ} style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#888", marginBottom: 8, textTransform: "uppercase" as any, letterSpacing: 0.5 }}>
              {typ} ({fotos.filter((f: any) => f.typ === typ).length})
            </div>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: 10 }}>
              {fotos.filter((f: any) => f.typ === typ).map((f: any) => (
                <div key={f.id} style={{ borderRadius: 10, overflow: "hidden", border: "1px solid #eee", position: "relative" }}>
                  <div onClick={() => setLightbox(f)} style={{ cursor: "pointer", height: 130, overflow: "hidden" }}>
                    <img src={f.url} alt={f.typ}
                      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", pointerEvents: "none" }}
                      onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  </div>
                  <div style={{ padding: "5px 8px", background: "#fff" }}>
                    <div style={{ fontSize: 9, color: "#aaa" }}>{f.erstellt_von}</div>
                  </div>
                  <button onClick={e => { e.stopPropagation(); deleteFoto(f.id); }}
                    style={{ position: "absolute", top: 5, right: 5, background: "rgba(0,0,0,0.55)", border: "none", borderRadius: "50%", width: 22, height: 22, cursor: "pointer", color: "#fff", fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      {/* Lightbox */}
      {lightbox && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.92)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", zIndex: 99999 }}
          onClick={() => setLightbox(null)}>
          <button onClick={e => { e.stopPropagation(); setLightbox(null); }}
            style={{ position: "fixed", top: 16, right: 16, background: "rgba(255,255,255,0.15)", border: "none", borderRadius: "50%", width: 44, height: 44, cursor: "pointer", color: "#fff", fontSize: 22, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
          <img src={lightbox.url} onClick={e => e.stopPropagation()}
            style={{ maxWidth: "95vw", maxHeight: "85vh", objectFit: "contain", borderRadius: 8, cursor: "default" }} />
          <div style={{ marginTop: 12, color: "rgba(255,255,255,0.5)", fontSize: 12 }}>
            {lightbox.typ} · {lightbox.erstellt_von}
          </div>
        </div>
      )}
    </div>
  );
}
