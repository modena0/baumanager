import { ST_COL } from "./constants";
import type { CSSProperties } from "react";

export function getProgress(b: any): number {
  const auf = b.aufgaben || [];
  if (!auf.length) return b.status === "abgeschlossen" ? 100 : 0;
  return Math.round(auf.filter((a: any) => a.erledigt).length / auf.length * 100);
}

export function pill(s: string, sm?: boolean): CSSProperties {
  const c = ST_COL[s] || "#888";
  return {
    display: "inline-block",
    padding: sm ? "1px 8px" : "2px 10px",
    borderRadius: 20,
    fontSize: sm ? 10 : 11,
    fontWeight: 500,
    background: c + "22",
    color: c,
    border: "1px solid " + c + "44",
  };
}

export function autoKat(m: any): string {
  if (m.kategorie) return m.kategorie;
  const fl = typeof m.fuehrerschein === "string" 
    ? m.fuehrerschein.split(",").map((s: string) => s.trim())
    : (m.fuehrerschein || []);
  const ql = (typeof m.qualifikationen === "string"
    ? m.qualifikationen.split(",").map((s: string) => s.trim())
    : (m.qualifikationen || [])).map((q: string) => q.toLowerCase());
  if (fl.some((f: string) => ["C","CE","C1","C1E"].includes(f)) || ql.some((q: string) => q.includes("lkw") || q.includes("transport"))) return "LKW Fahrer";
  if (ql.some((q: string) => ["tiefbau","sprengung","bagger"].some(k => q.includes(k)))) return "Tiefbau";
  if (ql.some((q: string) => ["lsa","elektro","sicherheitstechnik"].some(k => q.includes(k)))) return "LSA";
  return "Sonstige";
}