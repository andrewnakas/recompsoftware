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
- Deploy (owner-run until a permission rule exists): `npx wrangler@4 pages deploy dist --project-name recompsoftware --branch main`

## Discord rules
Owner's own logged-in Chrome, read-only, human pace, only when a sweep is started. Nothing from members-only channels published verbatim or attributed; public stories cite public links.

## Owner to-do
- Cloudflare: add both zones; Namecheap nameservers → Cloudflare; Pages project `recompsoftware`; custom domain; www → apex.
- GitHub: `andrewnakas/recompsoftware` (public), secrets CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID.
- GA4 property → set `PUBLIC_GA_ID` in the Pages build env / workflow.

## Log
- 2026-10-13: scaffold, all v1 pages, validate/fetch-stats/sweep scripts, CI workflow. First Discord sweep (REA, ArtCraft). First news (Xbox Labs, FigCraft, Smash recomp, GoldenEye 100%). Catalogue research done: 299 projects (170 games, 36 apps, 27 os, 28 preservation, 38 tools), 50 history events, lineage. 408 pages build, 0 errors; phone layout checked headlessly (`node scripts/shots.mjs` → .cache/shots/sheet.png). Local commit 98e0b6d.
- Open: 11 owner clean-room builds run the retail program on EmulatorJS (DK64, Conker, BT, MP1-3, Yoshi, 1080, Stadium 2, Wave Race, SMB) — notes say so; owner to decide if they belong on the Play shelf. Star deltas need 7 days of snapshots (fine-grained PAT can't read stargazer dates). 8 history/lineage slugs lack entries (mame, doom, quake, quake-3, openrct2, rt64, zapd).
