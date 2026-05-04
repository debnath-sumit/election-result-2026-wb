"use client";

import { useMemo, useState } from "react";
import type { ConstituencyResult } from "@/lib/types";
import { partyStyle } from "@/lib/partyColors";

type SortKey = "number" | "constituency" | "winner" | "runnerUp" | "margin";
type SortDir = "asc" | "desc";

const STATUS_LABEL: Record<ConstituencyResult["status"], string> = {
  "Result Declared": "Declared",
  Leading: "Leading",
  Counting: "Counting",
  Unknown: "—",
};

export default function ResultsTable({ results }: { results: ConstituencyResult[] }) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "declared" | "leading">(
    "all"
  );
  const [sortKey, setSortKey] = useState<SortKey>("number");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let rows = results;
    if (statusFilter === "declared")
      rows = rows.filter((r) => r.status === "Result Declared");
    else if (statusFilter === "leading")
      rows = rows.filter((r) => r.status === "Leading");
    if (q) {
      rows = rows.filter(
        (r) =>
          r.constituency.toLowerCase().includes(q) ||
          r.winner?.candidate.toLowerCase().includes(q) ||
          r.winner?.party.toLowerCase().includes(q) ||
          r.winner?.partyShort.toLowerCase().includes(q) ||
          r.runnerUp?.party.toLowerCase().includes(q) ||
          r.runnerUp?.partyShort.toLowerCase().includes(q)
      );
    }
    const dir = sortDir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const v = (() => {
        switch (sortKey) {
          case "number":
            return a.number - b.number;
          case "constituency":
            return a.constituency.localeCompare(b.constituency);
          case "winner":
            return (a.winner?.partyShort ?? "").localeCompare(
              b.winner?.partyShort ?? ""
            );
          case "runnerUp":
            return (a.runnerUp?.partyShort ?? "").localeCompare(
              b.runnerUp?.partyShort ?? ""
            );
          case "margin":
            return (a.margin ?? -1) - (b.margin ?? -1);
        }
      })();
      return v * dir;
    });
  }, [results, query, statusFilter, sortKey, sortDir]);

  const setSort = (k: SortKey) => {
    if (sortKey === k) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else {
      setSortKey(k);
      setSortDir(k === "margin" ? "desc" : "asc");
    }
  };

  const ariaSort = (k: SortKey) =>
    sortKey === k ? (sortDir === "asc" ? "ascending" : "descending") : "none";

  return (
    <div>
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search constituency, candidate, or party…"
          className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 sm:max-w-md dark:border-slate-700 dark:bg-slate-900"
        />
        <div className="flex gap-1 text-xs">
          {(["all", "declared", "leading"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setStatusFilter(k)}
              className={`rounded-full border px-3 py-1 capitalize transition ${
                statusFilter === k
                  ? "border-sky-500 bg-sky-500 text-white"
                  : "border-slate-300 bg-white text-slate-700 hover:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
              }`}
            >
              {k}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-2 text-xs text-slate-500">
        Showing <span className="font-semibold tabular-nums">{filtered.length}</span> of{" "}
        {results.length}
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-600 dark:bg-slate-900 dark:text-slate-400">
            <tr>
              <Th onClick={() => setSort("number")} ariaSort={ariaSort("number")} className="w-14">
                #
              </Th>
              <Th
                onClick={() => setSort("constituency")}
                ariaSort={ariaSort("constituency")}
              >
                Constituency
              </Th>
              <Th onClick={() => setSort("winner")} ariaSort={ariaSort("winner")}>
                Winner
              </Th>
              <Th onClick={() => setSort("runnerUp")} ariaSort={ariaSort("runnerUp")}>
                Runner-up
              </Th>
              <Th
                onClick={() => setSort("margin")}
                ariaSort={ariaSort("margin")}
                className="text-right"
              >
                Margin
              </Th>
              <th className="px-3 py-2 text-xs">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-3 py-10 text-center text-slate-500 italic"
                >
                  No results match your filter.
                </td>
              </tr>
            )}
            {filtered.map((r) => (
              <tr
                key={r.number}
                className="border-t border-slate-100 hover:bg-slate-50 dark:border-slate-900 dark:hover:bg-slate-900/50"
              >
                <td className="px-3 py-2 font-mono text-xs text-slate-500 tabular-nums">
                  {r.number}
                </td>
                <td className="px-3 py-2 font-medium">{r.constituency}</td>
                <td className="px-3 py-2">
                  <CandidateCell
                    candidate={r.winner?.candidate}
                    party={r.winner?.party}
                    partyShort={r.winner?.partyShort}
                  />
                </td>
                <td className="px-3 py-2">
                  <CandidateCell
                    candidate={r.runnerUp?.candidate}
                    party={r.runnerUp?.party}
                    partyShort={r.runnerUp?.partyShort}
                    muted
                  />
                </td>
                <td className="px-3 py-2 text-right font-mono tabular-nums">
                  {r.margin != null ? r.margin.toLocaleString("en-IN") : "—"}
                </td>
                <td className="px-3 py-2 text-xs">
                  <StatusPill status={r.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({
  children,
  onClick,
  ariaSort,
  className = "",
}: {
  children: React.ReactNode;
  onClick: () => void;
  ariaSort: "ascending" | "descending" | "none";
  className?: string;
}) {
  return (
    <th
      aria-sort={ariaSort}
      className={`cursor-pointer select-none px-3 py-2 hover:text-slate-900 dark:hover:text-white ${className}`}
      onClick={onClick}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        <span className="text-[10px] text-slate-400">
          {ariaSort === "ascending" ? "▲" : ariaSort === "descending" ? "▼" : "↕"}
        </span>
      </span>
    </th>
  );
}

function CandidateCell({
  candidate,
  party,
  partyShort,
  muted = false,
}: {
  candidate?: string;
  party?: string;
  partyShort?: string;
  muted?: boolean;
}) {
  if (!candidate || !party) return <span className="text-slate-400">—</span>;
  const s = partyStyle(partyShort ?? "", party);
  return (
    <div className="flex flex-col">
      <span className={muted ? "text-slate-700 dark:text-slate-300" : "font-medium"}>
        {candidate}
      </span>
      <span
        className={`mt-0.5 inline-flex w-fit items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${s.bg} ${s.text} ${s.border}`}
        title={party}
      >
        {partyShort || party}
      </span>
    </div>
  );
}

function StatusPill({ status }: { status: ConstituencyResult["status"] }) {
  const map: Record<ConstituencyResult["status"], string> = {
    "Result Declared":
      "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/40 dark:text-emerald-200 dark:border-emerald-800",
    Leading:
      "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/40 dark:text-amber-200 dark:border-amber-800",
    Counting:
      "bg-sky-100 text-sky-800 border-sky-300 dark:bg-sky-900/40 dark:text-sky-200 dark:border-sky-800",
    Unknown:
      "bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-900/40 dark:text-slate-400 dark:border-slate-800",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${map[status]}`}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}
