# Recomp hub — STATUS

Site: recompsoftware.com (owner bought only this one; recompiledsoftware.com was never registered). GitHub: andrewnakas/recompsoftware. Plan: `C:\Users\andre\.claude\plans\joyful-swimming-heron.md`.

## Layout
- `apps/web` — Astro 5 static site (theme forked from skatemods; accent phosphor green). `npm run build` = validate + astro build → `apps/web/dist`.
- `data/projects/{games,apps,os,tools,preservation}.json` — catalogue (schema: `data/SCHEMA.md`). `data/history.json`, `data/lineage.json`, `data/news.json` (published news, human-checked).
- `data/stats/` — daily GitHub snapshots (`scripts/fetch-stats.mjs`), `latest.json` drives trending. Bootstraps 7/30-day deltas from the newest 100 stargazer timestamps until real snapshots exist.
- `data/inbox/` — PRIVATE leads (gitignored): `<date>-sweep.json` from `scripts/intel/sweep.mjs` (GitHub search, Reddit Atom feeds, news RSS, lobste.rs/HN), `<date>-discord.md` from Chrome sweeps. Leads → verified → `news.json` / catalogue entries.
- `data/sources/feeds.json` (queries, subreddits, feeds), `discord.json` (servers, channels, last sweep), `seen.json` (dedupe).
- `RECOMP_DATA=<dir>` points the site/scripts at another data dir (fixtures).

## Commands
- `node scripts/validate.mjs` · `node scripts/fetch-stats.mjs` · `node scripts/intel/sweep.mjs --days 7`
- `cd apps/web && npm run build` · preview: `npx astro preview`
- Deploy: `cd apps/web && npm run build && npx wrangler@4 deploy` (Workers static assets, config apps/web/wrangler.jsonc; live preview https://recompsoftware.andrew-nakas.workers.dev). Do NOT use `wrangler pages project create`: it rewrote the Astro config to an SSR adapter.

## Discord rules
Owner's own logged-in Chrome, read-only, human pace, only when a sweep is started. Nothing from members-only channels published verbatim or attributed; public stories cite public links.

## Live (2026-10-14)
- recompsoftware.com + www on Cloudflare Workers static assets. GitHub Actions (secrets CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID set) snapshots stats daily 05:23 UTC, rebuilds/deploys every 6 h, pings Bing IndexNow. First manual run 38526184109 green.
- Google Search Console: URL-prefix property https://recompsoftware.com/ verified by meta tag (Base.astro; do not remove), sitemap submitted (427 pages). Property is in the Google account signed in to Chrome.

## Owner to-do (old)
- Cloudflare: add both zones; Namecheap nameservers → Cloudflare; Pages project `recompsoftware`; custom domain; www → apex.
- GitHub: `andrewnakas/recompsoftware` (public), secrets CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID.
- GA4 property → set `PUBLIC_GA_ID` in the Pages build env / workflow.

## Log
- 2026-10-13: scaffold, all v1 pages, validate/fetch-stats/sweep scripts, CI workflow. First Discord sweep (REA, ArtCraft). First news (Xbox Labs, FigCraft, Smash recomp, GoldenEye 100%). Catalogue research done: 299 projects (170 games, 36 apps, 27 os, 28 preservation, 38 tools), 50 history events, lineage. 408 pages build, 0 errors; phone layout checked headlessly (`node scripts/shots.mjs` → .cache/shots/sheet.png). Local commit 98e0b6d.
- Open: 11 owner clean-room builds run the retail program on EmulatorJS (DK64, Conker, BT, MP1-3, Yoshi, 1080, Stadium 2, Wave Race, SMB) — notes say so; owner to decide if they belong on the Play shelf. Star deltas need 7 days of snapshots (fine-grained PAT can't read stargazer dates). 8 history/lineage slugs lack entries (mame, doom, quake, quake-3, openrct2, rt64, zapd).
- 2026-10-14: GA4 live (G-VB7864XCBM, default in Base.astro). Owner: the 11 retail-program clean rooms stay on the Play shelf. Catalogue grown 317 → 1572 (games 869, tools 421, os 97, preservation 130, apps 55):
  - `scripts/intel/harvest.mjs` gathers candidates from GitHub searches and scene lists (2,470 at 25+ stars), written to `.cache/harvest.json`.
  - `enrich.mjs` adds latest release, the README head and AI signals (CLAUDE.md/AGENTS.md, README wording).
  - 8 write-up agents applied `.cache/new/BRIEF.md`.
  - `merge-new.mjs` appends the results and skips repos already tracked.
  - Hand review dropped retail-text/unidentified/DRM-adjacent entries and duplicate mirrors, and relabelled 18 entries from README AI statements.
  - Provenance rule: CLAUDE.md/AGENTS.md or a README statement → ai-assisted; "almost entirely AI" → ai-generated; repo created before 2023 → human-led; explicit no-AI policy → human-led; otherwise unknown.
  - The 10+ star round-2 pool (`.cache/harvest-r2.json`) is unreviewed. Next growth: run the same pipeline on it.
