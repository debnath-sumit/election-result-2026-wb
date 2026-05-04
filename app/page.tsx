import resultsJson from "@/data/results.json";
import type { ResultsPayload } from "@/lib/types";
import { partyStyle } from "@/lib/partyColors";
import ResultsTable from "./ResultsTable";

export const revalidate = 60;

export default function Page() {
  const data = resultsJson as ResultsPayload;
  const declared = data.results.filter((r) => r.status === "Result Declared").length;
  const leading = data.results.filter((r) => r.status === "Leading").length;

  const partyTallyMap = new Map<
    string,
    { partyShort: string; party: string; won: number; leading: number }
  >();
  for (const r of data.results) {
    if (!r.winner) continue;
    const key = r.winner.partyShort || r.winner.party;
    const entry =
      partyTallyMap.get(key) ?? {
        partyShort: r.winner.partyShort,
        party: r.winner.party,
        won: 0,
        leading: 0,
      };
    if (r.status === "Result Declared") entry.won += 1;
    else if (r.status === "Leading") entry.leading += 1;
    partyTallyMap.set(key, entry);
  }
  const partyTally = Array.from(partyTallyMap.values())
    .map((p) => ({ ...p, total: p.won + p.leading }))
    .filter((p) => p.total > 0)
    .sort((a, b) => b.total - a.total || b.won - a.won);
  const fmt = (iso: string) =>
    iso === "1970-01-01T00:00:00.000Z"
      ? "—"
      : new Date(iso).toLocaleString("en-IN", {
          dateStyle: "medium",
          timeStyle: "short",
          timeZone: "Asia/Kolkata",
        });

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="mb-6">
        <p className="text-xs uppercase tracking-widest text-slate-500">
          {data.electionTitle}
        </p>
        <h1 className="mt-1 text-3xl font-bold sm:text-4xl">
          {data.state} — Constituency-wise Results
        </h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Source:{" "}
          <a
            href={data.source}
            target="_blank"
            rel="noreferrer"
            className="underline hover:text-sky-600"
          >
            results.eci.gov.in
          </a>
          {" · "}Last updated:{" "}
          <span className="font-mono">{fmt(data.scrapedAt)}</span> IST
        </p>
      </header>

      <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Total seats" value={data.totalConstituencies} />
        <Stat label="Results declared" value={declared} accent="emerald" />
        <Stat label="Leading" value={leading} accent="amber" />
        <Stat
          label="Pending"
          value={data.totalConstituencies - declared - leading}
          accent="slate"
        />
      </section>

      <section className="mb-6">
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
            Party-wise tally
          </h2>
          <span className="text-xs text-slate-500">Won + Leading</span>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {partyTally.map((p) => {
            const s = partyStyle(p.partyShort, p.party);
            return (
              <div
                key={p.partyShort || p.party}
                className={`rounded-lg border ${s.border} ${s.bg} p-3 dark:bg-white/5`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`truncate text-sm font-semibold ${s.text} dark:text-slate-100`}
                    title={p.party}
                  >
                    {p.partyShort || p.party}
                  </span>
                  <span className="text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100">
                    {p.total}
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-3 text-xs text-slate-700 dark:text-slate-300">
                  <span>
                    Won <span className="font-semibold tabular-nums">{p.won}</span>
                  </span>
                  {p.leading > 0 && (
                    <span>
                      Leading{" "}
                      <span className="font-semibold tabular-nums">{p.leading}</span>
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <ResultsTable results={data.results} />

      <footer className="mt-10 space-y-2 text-xs text-slate-500">
        <p>
          Data scraped from the Election Commission of India. This site is unofficial
          and provided for convenience only. For authoritative results, refer to{" "}
          <a
            className="underline hover:text-sky-600"
            href="https://results.eci.gov.in/"
            target="_blank"
            rel="noreferrer"
          >
            results.eci.gov.in
          </a>
          .
        </p>
        <p>
          Designed by{" "}
          <span className="font-semibold text-slate-700 dark:text-slate-200">
            Sumit Debnath
          </span>
        </p>
      </footer>
    </main>
  );
}

function Stat({
  label,
  value,
  accent = "slate",
}: {
  label: string;
  value: number;
  accent?: "slate" | "emerald" | "amber";
}) {
  const accents: Record<string, string> = {
    slate: "border-slate-200 dark:border-slate-800",
    emerald: "border-emerald-300 dark:border-emerald-800",
    amber: "border-amber-300 dark:border-amber-800",
  };
  return (
    <div
      className={`rounded-lg border ${accents[accent]} bg-white/50 p-3 dark:bg-white/5`}
    >
      <div className="text-xs uppercase tracking-wider text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}
