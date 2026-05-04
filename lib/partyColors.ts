// Map common party short codes / full names to a small palette.
// Returns Tailwind class fragments for background + text + border.
export type PartyStyle = { bg: string; text: string; border: string };

const STYLES: Record<string, PartyStyle> = {
  AITC: { bg: "bg-emerald-100", text: "text-emerald-900", border: "border-emerald-300" },
  TMC: { bg: "bg-emerald-100", text: "text-emerald-900", border: "border-emerald-300" },
  BJP: { bg: "bg-orange-100", text: "text-orange-900", border: "border-orange-300" },
  INC: { bg: "bg-sky-100", text: "text-sky-900", border: "border-sky-300" },
  CPM: { bg: "bg-red-100", text: "text-red-900", border: "border-red-300" },
  "CPI(M)": { bg: "bg-red-100", text: "text-red-900", border: "border-red-300" },
  CPI: { bg: "bg-red-100", text: "text-red-900", border: "border-red-300" },
  RSP: { bg: "bg-rose-100", text: "text-rose-900", border: "border-rose-300" },
  AIFB: { bg: "bg-rose-100", text: "text-rose-900", border: "border-rose-300" },
  IND: { bg: "bg-zinc-100", text: "text-zinc-900", border: "border-zinc-300" },
  NOTA: { bg: "bg-zinc-100", text: "text-zinc-700", border: "border-zinc-300" },
};

const FALLBACK: PartyStyle = {
  bg: "bg-slate-100",
  text: "text-slate-900",
  border: "border-slate-300",
};

export function partyStyle(short: string, full?: string): PartyStyle {
  const key = (short || "").toUpperCase().trim();
  if (STYLES[key]) return STYLES[key];
  if (full) {
    const f = full.toLowerCase();
    if (/trinamool/.test(f)) return STYLES.AITC;
    if (/bharatiya janata/.test(f)) return STYLES.BJP;
    if (/indian national congress/.test(f)) return STYLES.INC;
    if (/communist party of india\s*\(marxist\)/.test(f)) return STYLES.CPM;
    if (/communist party of india/.test(f)) return STYLES.CPI;
    if (/independent/.test(f)) return STYLES.IND;
    if (/none of the above/.test(f)) return STYLES.NOTA;
  }
  return FALLBACK;
}
