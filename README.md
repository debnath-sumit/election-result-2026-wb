# election-result-2026-wb

Live constituency-wise results for the **West Bengal Legislative Assembly Election, May 2026**, scraped from [results.eci.gov.in](https://results.eci.gov.in/).

## Stack

- Next.js 14 (App Router) · React 18 · TypeScript · Tailwind CSS v4
- Playwright headless Chromium for scraping (ECI is Akamai-protected, blocks plain HTTP)
- GitHub Actions cron (every 10 min) commits `data/results.json`
- Vercel serves the Next.js site (ISR, `revalidate = 60`)

## Local development

```bash
pnpm install
pnpm dev          # http://localhost:3000
```

## Run the scraper locally

```bash
pnpm exec playwright install chromium
pnpm scrape                      # scrape all 294 ACs
pnpm scrape -- --debug --ac 1    # scrape only AC #1 and dump HTML to tmp/ for selector tuning
```

Output is written to `data/results.json`.

## How the live updates work

1. `.github/workflows/scrape.yml` runs `pnpm scrape` on a 10-minute cron.
2. If `data/results.json` changed, the workflow commits it back to `main`.
3. Vercel detects the push and rebuilds (or serves the next ISR fetch).
4. Browsers see fresh data within ~1 minute of the commit.

The workflow needs `contents: write` permission, which is enabled in the workflow file. No additional GitHub secrets are required.

## Deploy

```bash
gh repo create election-result-2026-wb --public --source=. --push
# then import the repo on https://vercel.com/new
```

## Disclaimer

Unofficial. For authoritative results refer to the [Election Commission of India](https://results.eci.gov.in/).
