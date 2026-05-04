/* eslint-disable @typescript-eslint/no-explicit-any */
import { chromium as chromiumExtra } from "playwright-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import type { Browser, Page } from "playwright";
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { ConstituencyResult, ResultsPayload } from "../lib/types";

chromiumExtra.use(StealthPlugin());

const STATE_CODE = "S25";
const STATE = "West Bengal";
const ELECTION = "Legislative Assembly Election, May 2026";
const TOTAL_AC = 294;
const BASE = "https://results.eci.gov.in/ResultAcGenMay2026";
const CONCURRENCY = 5;
const RETRIES = 3;
const NAV_TIMEOUT_MS = 30_000;
const OUT_PATH = join(process.cwd(), "data", "results.json");

const DEBUG = process.argv.includes("--debug");
const flagNumber = (flag: string): number | null => {
  const idx = process.argv.indexOf(flag);
  if (idx < 0) return null;
  const n = Number(process.argv[idx + 1]);
  return Number.isFinite(n) ? n : null;
};
const DEBUG_AC = flagNumber("--ac");
const LIMIT = flagNumber("--limit");

function parseInt0(s: string | null | undefined): number {
  if (!s) return 0;
  const n = Number(String(s).replace(/[^\d-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

async function warmUp(page: Page): Promise<void> {
  // Visit the homepage first so Akamai's JS challenge runs and sets _abck,
  // then walk into the WB partywise page like a real user would.
  await page.goto("https://results.eci.gov.in/", {
    waitUntil: "domcontentloaded",
    timeout: NAV_TIMEOUT_MS,
  });
  await page.waitForTimeout(2500);
  await page.goto(`${BASE}/partywiseresult-${STATE_CODE}.htm`, {
    waitUntil: "domcontentloaded",
    timeout: NAV_TIMEOUT_MS,
  });
  await page.waitForTimeout(2500);
}

type Extracted = Omit<ConstituencyResult, "number">;

// Passed to page.evaluate as a string IIFE to bypass tsx/esbuild's __name() instrumentation.
const EXTRACT_FN = `(() => {
    const text = (el) =>
      (el && el.textContent ? el.textContent : "").replace(/\\s+/g, " ").trim();

    const PARTY_ABBR = {
      "all india trinamool congress": "AITC",
      "trinamool congress": "AITC",
      "bharatiya janata party": "BJP",
      "indian national congress": "INC",
      "communist party of india  (marxist)": "CPI(M)",
      "communist party of india (marxist)": "CPI(M)",
      "communist party of india": "CPI",
      "all india forward bloc": "AIFB",
      "revolutionary socialist party": "RSP",
      "socialist unity centre of india (communist)": "SUCI(C)",
      "indian secular front": "ISF",
      "all india majlis-e-ittehadul muslimeen": "AIMIM",
      "bahujan samaj party": "BSP",
      "samajwadi party": "SP",
      "rashtriya janata dal": "RJD",
      "shiromani akali dal": "SAD",
      "kamtapur progressive party": "KPP",
      "gorkha janmukti morcha": "GJM",
      "independent": "IND",
      "none of the above": "NOTA",
    };
    const abbrev = (raw) => {
      if (!raw) return "";
      const key = raw.trim().toLowerCase();
      if (PARTY_ABBR[key]) return PARTY_ABBR[key];
      const m = raw.match(/^(.*?)\\s*\\(([^)]+)\\)\\s*$/);
      if (m) return m[2].trim().toUpperCase();
      // build initials from words longer than 2 chars
      const words = raw.split(/\\s+/).filter((w) => w.length > 2);
      if (words.length >= 2 && words.length <= 6)
        return words.map((w) => w[0].toUpperCase()).join("");
      return raw.trim();
    };

    // ----- Constituency name -----
    let constituency = "";
    const h2 = document.querySelector("h2");
    if (h2) {
      let t = text(h2);
      // "Assembly Constituency 1 - MEKLIGANJ (West Bengal)" → "1 - MEKLIGANJ"
      t = t.replace(/^Assembly Constituency\\s+/i, "");
      t = t.replace(/\\s*\\(\\s*West Bengal\\s*\\)\\s*$/i, "");
      constituency = t.trim();
    }
    if (!constituency) {
      const h = document.querySelector("h1, h3, h4");
      if (h) constituency = text(h);
    }

    // ----- Status -----
    const bodyText = text(document.body);
    let status = "Unknown";
    let roundsCounted = null;
    let roundsTotal = null;
    const roundEl = document.querySelector(".round-status");
    if (roundEl) {
      const m = text(roundEl).match(/(\\d+)\\s*\\/\\s*(\\d+)/);
      if (m) {
        roundsCounted = parseInt(m[1], 10);
        roundsTotal = parseInt(m[2], 10);
        if (roundsCounted > 0 && roundsCounted === roundsTotal) status = "Result Declared";
        else if (roundsCounted < roundsTotal) status = "Counting";
      }
    }
    if (/result\\s+declared/i.test(bodyText)) status = "Result Declared";
    else if (status === "Unknown" && /\\bleading\\b/i.test(bodyText)) status = "Leading";

    // ----- Candidate table -----
    const candidates = [];
    const tables = Array.from(document.querySelectorAll("table"));
    for (const tbl of tables) {
      const rows = Array.from(tbl.querySelectorAll("tr"));
      if (rows.length < 2) continue;
      const headerCells = Array.from(rows[0].querySelectorAll("th, td")).map((c) =>
        text(c).toLowerCase()
      );
      const headerJoined = headerCells.join("|");
      const looksLikeCands =
        /candidate/.test(headerJoined) &&
        /party/.test(headerJoined) &&
        /(total|votes)/.test(headerJoined);
      if (!looksLikeCands) continue;

      const candIdx = headerCells.findIndex((h) => /candidate/.test(h));
      const partyIdx = headerCells.findIndex((h) => /party/.test(h));
      let votesIdx = headerCells.findIndex((h) => /total\\s*votes/.test(h));
      if (votesIdx === -1)
        votesIdx = headerCells.findIndex((h) => /^votes$/.test(h.trim()));
      if (votesIdx === -1)
        votesIdx = headerCells.findIndex((h) => /votes/.test(h));

      for (const r of rows.slice(1)) {
        // skip footer rows that live inside <tfoot>
        if (r.closest("tfoot")) continue;
        const cells = Array.from(r.querySelectorAll("td")).map((c) => text(c));
        if (cells.length < 3) continue;
        const candidate = candIdx >= 0 ? cells[candIdx] : cells[1] || "";
        const party = partyIdx >= 0 ? cells[partyIdx] : cells[2] || "";
        const votesRaw = votesIdx >= 0 ? cells[votesIdx] : cells[cells.length - 2] || "";
        const votes = Number(String(votesRaw).replace(/[^\\d-]/g, ""));
        if (!candidate || !party || !Number.isFinite(votes)) continue;
        if (/^total\\b/i.test(candidate) || /^total\\b/i.test(party)) continue;
        candidates.push({ candidate, party, votes });
      }
      if (candidates.length) break;
    }

    candidates.sort((a, b) => b.votes - a.votes);
    const top = candidates[0];
    const second = candidates[1];
    const totalVotes = candidates.reduce((s, c) => s + c.votes, 0) || null;

    return {
      constituency,
      status,
      roundsCounted,
      roundsTotal,
      winner: top
        ? { candidate: top.candidate, party: top.party, partyShort: abbrev(top.party), votes: top.votes }
        : null,
      runnerUp: second
        ? { candidate: second.candidate, party: second.party, partyShort: abbrev(second.party), votes: second.votes }
        : null,
      margin: top && second ? top.votes - second.votes : null,
      totalVotes,
    };
  })()`;

async function extractFromPage(page: Page): Promise<Extracted> {
  return page.evaluate(EXTRACT_FN as any) as Promise<Extracted>;
}

async function scrapeOne(
  browser: Browser,
  acNumber: number
): Promise<ConstituencyResult> {
  const url = `${BASE}/Constituencywise${STATE_CODE}${acNumber}.htm`;
  let lastErr: unknown;
  for (let attempt = 1; attempt <= RETRIES; attempt++) {
    const ctx = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      viewport: { width: 1280, height: 900 },
      locale: "en-IN",
    });
    const page = await ctx.newPage();
    try {
      await warmUp(page);
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT_MS });
      await page.waitForTimeout(1500);

      if (DEBUG && (DEBUG_AC === null || DEBUG_AC === acNumber)) {
        const html = await page.content();
        await mkdir(join(process.cwd(), "tmp"), { recursive: true });
        await writeFile(join(process.cwd(), "tmp", `ac-${acNumber}.html`), html);
        console.log(`  [debug] dumped tmp/ac-${acNumber}.html`);
      }

      const extracted = await extractFromPage(page);
      await ctx.close();
      return { number: acNumber, ...extracted };
    } catch (err) {
      lastErr = err;
      await ctx.close().catch(() => {});
      if (attempt < RETRIES) {
        const wait = 1000 * attempt;
        console.warn(`  AC ${acNumber} attempt ${attempt} failed (${(err as Error).message}); retrying in ${wait}ms`);
        await new Promise((r) => setTimeout(r, wait));
      }
    }
  }
  console.error(`  AC ${acNumber} FAILED after ${RETRIES} attempts: ${(lastErr as Error)?.message}`);
  return {
    number: acNumber,
    constituency: `AC ${acNumber}`,
    status: "Unknown",
    roundsCounted: null,
    roundsTotal: null,
    winner: null,
    runnerUp: null,
    margin: null,
    totalVotes: null,
  };
}

async function runPool<T, R>(
  items: T[],
  size: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  await Promise.all(
    Array.from({ length: size }, async () => {
      while (true) {
        const i = cursor++;
        if (i >= items.length) return;
        results[i] = await worker(items[i]);
      }
    })
  );
  return results;
}

async function main() {
  const browser = (await chromiumExtra.launch({
    headless: true,
    args: [
      "--disable-blink-features=AutomationControlled",
      "--disable-features=IsolateOrigins,site-per-process",
      "--no-sandbox",
    ],
  })) as Browser;

  const acList =
    DEBUG_AC !== null
      ? [DEBUG_AC]
      : Array.from(
          { length: LIMIT && LIMIT > 0 ? Math.min(LIMIT, TOTAL_AC) : TOTAL_AC },
          (_, i) => i + 1
        );

  console.log(
    `Scraping ${acList.length} ${STATE} constituencies (concurrency=${CONCURRENCY})…`
  );
  const started = Date.now();
  let done = 0;
  const results = await runPool(acList, CONCURRENCY, async (n) => {
    const r = await scrapeOne(browser, n);
    done++;
    if (done % 20 === 0 || done === acList.length) {
      console.log(`  progress: ${done}/${acList.length}`);
    }
    return r;
  });
  console.log(`Scraped in ${((Date.now() - started) / 1000).toFixed(1)}s`);

  await browser.close();

  const payload: ResultsPayload = {
    state: STATE,
    stateCode: STATE_CODE,
    electionTitle: ELECTION,
    source: `${BASE}/`,
    scrapedAt: new Date().toISOString(),
    totalConstituencies: TOTAL_AC,
    results: results.sort((a, b) => a.number - b.number),
  };

  await mkdir(join(process.cwd(), "data"), { recursive: true });
  await writeFile(OUT_PATH, JSON.stringify(payload, null, 2) + "\n");
  console.log(`Wrote ${OUT_PATH}`);

  const filled = results.filter((r) => r.winner).length;
  console.log(`  parsed winners for ${filled}/${results.length} constituencies`);
  if (filled === 0) {
    console.error(
      "WARNING: zero winners parsed. Run with `--debug --ac 1` and inspect tmp/ac-1.html to adjust selectors."
    );
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
