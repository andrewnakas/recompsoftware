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
- CI-equivalent build (R2 data, snapshot, pictures): `cd apps/web && npm run cf-build && npm run cf-deploy`
- Deploy: `cd apps/web && npm run build && npx wrangler@4 deploy` (Workers static assets, config apps/web/wrangler.jsonc; live preview https://recompsoftware.andrew-nakas.workers.dev). Do NOT use `wrangler pages project create`: it rewrote the Astro config to an SSR adapter.

## Hosting move: everything on Cloudflare (started 2026-10-19)
Goal: recompsoftware.com fully on Cloudflare (registrar, DNS, build, deploy, schedules, generated data). Only the source repo stays on GitHub (Workers Builds pulls from it; /submit/ uses its issues) and GitHub's API stays a data source. GA4 + the Search Console meta tag are Google by design and stay. No downtime: the Worker keeps serving the whole time; Actions keeps running until Workers Builds is proven.

Audit (2026-10-19):
| Piece | Was | Now / target |
|---|---|---|
| Serving | CF Worker `recompsoftware` (static assets, custom domains apex + www) | unchanged |
| DNS | CF zone ab1a2756…, NS rosa/vin.ns.cloudflare.com, Free plan | done |
| Registrar | Namecheap, registered 2026-10-14, clientTransferProhibited, expires 2027-10-14 | CF Registrar; ICANN 60-day lock → transfer possible from 2026-12-14 (owner) |
| Email | MX eforward1-5.registrar-servers.com + SPF include:spf.efwd… (Namecheap forwarding, dies with the transfer); CF Email Routing on the zone = unconfigured, andrew.nakas@gmail.com is already a verified destination on the account | CF Email Routing (dashboard "Get started" replaces the eforward MX/SPF; catch-all → the verified Gmail) or delete the MX/SPF if unused (owner: DNS scope) |
| Build + deploy | GitHub Actions `site.yml` on push + every 6 h | Workers Builds on `recompsoftware`: root `apps/web`, build `npm run cf-build`, deploy `npm run cf-deploy` |
| Schedules | Actions cron 05:23 daily stats, */6 rebuild, Mondays pictures | Worker `recomp-cron` (apps/cron, deployed) cron `23 5,11,17,23 * * *` → Workers Builds deploy hook (secret DEPLOY_HOOK) |
| Stats snapshots | committed to git daily (~250 KB/day) | R2 `recompsoftware-data/stats.tgz`; git copy frozen at cutover as fallback |
| Pictures (media.json + 922 thumbs, 18 MB) | committed to git by Actions on Mondays | R2 `media.tgz` + `media-stamp.txt`; git copy = baseline; new entries' thumbs may still be committed by hand |
| IndexNow | Actions, every run | deploy step, once a day (flag from the stats snapshot) |
| Fonts | fonts.googleapis.com | self-hosted woff2 in public/fonts (latin + latin-ext), src/styles/fonts.css. Re-make: fetch the old css2 URL with a Chrome User-Agent, keep the latin + latin-ext blocks, download each woff2 into public/fonts |
| Other DNS | A/AAAA apex + www = Workers custom domains (proxied), no CAA/DMARC | unchanged |
| Google pieces | Search Console meta tag (Base.astro), GA4 G-VB7864XCBM, /submit/ → GitHub issues | stay by design; checked live 2026-10-19 |
| Secrets | GH secrets CLOUDFLARE_API_TOKEN/ACCOUNT_ID, github.token | Builds' own API token (has R2 edit) + build secret GITHUB_TOKEN (fine-grained, public read-only) |

How it works: `scripts/cf/build.mjs` pulls stats/media from R2 (merged over git: media.json keeps git-only keys, latest.json keeps the newer date, so hand-committed entries/thumbs survive) → snapshot if today's is missing → Monday picture refresh (only in a build without a snapshot, so the 11:23 run) → `npm run build` → pushes changed sets back → flags IndexNow. `scripts/cf/data.mjs pull|push [stats] [media]` works locally with wrangler's login (`npm run cf-build` = the full CI build on this machine). Without GITHUB_TOKEN or R2 the build still works on the git data.

Steps:
1. [done] R2 bucket, seeded from git (checked 2026-10-19: 1009 media entries + 923 thumbs, stats through 10-19); recomp-cron deployed (inert without DEPLOY_HOOK); cf-build/cf-deploy scripts; fonts self-hosted; site.yml gated on repo variable CF_BUILDS.
2. [owner — wrangler OAuth gets "Authentication error" on the Builds API and Claude in Chrome was not connected on 2026-10-19] Dashboard → Workers & Pages → recompsoftware → Settings → Builds → Connect GitHub `andrewnakas/recompsoftware` (authorise the Cloudflare GitHub app), branch main, root `apps/web`, build `npm run cf-build`, deploy `npm run cf-deploy`, API token "Create new", build secret GITHUB_TOKEN. Then Deploy Hooks → create one for main.
3. [agent] `cd apps/cron && npx wrangler@4 secret put DEPLOY_HOOK` (owner pastes the URL, or gives it to me); watch one push build + one hook build go green.
4. [agent] Cutover: `gh variable set CF_BUILDS --body on` → Actions stops scheduling/deploying (PR checks only). Then remove GH secrets CLOUDFLARE_*; later delete site.yml schedule entirely.
5. [owner] Email: decide forwarding → CF Email Routing (verify destination address) or drop MX/SPF. Before step 6.
6. [owner, from 2026-12-14] Namecheap: unlock domain, get EPP/auth code, turn off WhoisGuard if it blocks; CF dashboard → Domain Registration → Transfer, pay 1 year (~at-cost .com), approve the Namecheap transfer email. NS are already CF, so no DNS change and no downtime.
7. [optional] www → apex 301 (Redirect Rule; needs zone rules scope) — today both serve 200 with canonical to apex.

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
- 2026-10-15: GA4 = property "RecompSoftware" (account ChessGPT, a410684060p558977824). Week 1: 121 sessions, ~50% Google organic, top landings /, /recompiled-games-list, /p/ps2-web-recomp. Shipped: Download button (download_click), console list pages on /platforms/<slug>/ (normalize-platforms.mjs + _redirects), ConsoleStrip, news sweep (decomp.dev sunset, r/emulation recomp rule), +letsgo-recomp, +halo-64, r/recomps in feeds. Fixed: gtag was not global, so no custom click event had ever reached GA. Open: mark play_click/download_click as key events once they appear in GA; owner merges decompgames#4 + aimashups#16 (footer links).

## 2026-10-17/18: "make it amazing" pass (deployed, commit 42fc72c)
- Covers: scripts/fetch-media.mjs → data/media.json + public/thumbs (899 of ~2,218 repos; CI refreshes Mondays). Cover.astro falls back to platform-hued tiles.
- Home hero mosaic + "Just shipped" ticker; project page header image + sparkline; trending growth from data/stats snapshots (works before 7 days exist).
- Lineage: scripts/derive-lineage.mjs → data/lineage-derived.json (run by hand after harvests); force-laid SVG graph.
- Catalogue 1,574 → 2,232; news 8 → 33; /submit/ + issue templates (submit-project, correction).
- OG cards now JPEG with the project picture.
- Open calls for owner: win7-dwm-decomp (MS source sensitivity), live-service server emulators (runuo etc.), umk3-ios-decomp ai-generated vs ai-assisted, twisted-metal/driveclub provenance unknown.
- Build is now ~2,580 pages / ~7 min; run it detached (RAM pressure killed one run).
- 2026-10-19 (hosting move, E:\recomp-hub): reviewed the earlier uncommitted move edits; fixed scripts/cf/data.mjs pull to merge instead of overwrite (R2 would have reverted hand-added media/stats); verified a full local build (2,621 pages; Search Console tag, GA4, 27 _redirects, IndexNow key, self-hosted fonts, no fonts.googleapis left); committed 8d6739d. Builds connection, deploy hook and GITHUB_TOKEN secret wait on the owner (step 2), then the agent does steps 3-4.

## Progress tracker (built 2026-10-23)
/progress/ page + % bars on cards/tables + history chart on project pages + platform leaderboards + home "Decomp progress this week" strip.
- `scripts/fetch-progress.mjs` (daily, after fetch-stats, in site.yml and scripts/cf/build.mjs; data/progress rides in the R2 `stats` set). Sources best first: ByteMatch list API -> decomp.dev per-project JSON -> frogress (data/progress/frogress-map.json) -> the repo's own `*_report` Actions artifact (needs a token) -> README badges -> hand `progress`. `--discover` asks decomp.dev about every decomp repo (run it now and then; daily runs only ask repos known to be there).
- Owner rule (2026-10-23): everyone with progress gets a bar + chart, but only ranked sources (ByteMatch, decomp.dev, frogress = maintainer opted in) go on movers, leaderboards and milestones. `progressOptOut: true` on an entry removes it everywhere.
- 2026-10-23 evening: 87 ByteMatch projects added to the catalogue (batches 27-29; 12 rejected), OpenRAC repo URLs updated after renames; progress on ~275 repos, ByteMatch 88. `data/progress/site-map.json` reads the progress CSVs projects publish themselves (zelda64.dev OoT/MM/TMC, papermar.io, SAT-R) for full history back to 2020. ByteMatch entries under an old repo name are resolved through GitHub's rename redirect (cached in scan.json as `~owner/repo`).
- Traps: a README can carry several badges (sat-r/sa2: SA1 first): the fetcher prefers the one named after the repo, then matching ones. README badges copied from templates (three repos carried tww's frogress badge): shared badge URLs are dropped, frogress badges map only when the slug looks like the repo. decomp.dev has no index (projects.json = 410) and could vanish: last values are kept on failure.
- Leads: `.cache/progress-unmatched.txt` after each run lists ByteMatch projects not in the catalogue (the rest are deliberate rejects) -> harvest -> enrich -> write-up (BRIEF, paths now E:) -> merge-new.
- Checked 2026-10-23: the Actions `github.token` CAN download other public repos' artifacts (HTTP 200 via a throwaway workflow), so CI needs no extra secret. nightly.link refuses these artifacts, don't use it.

## GA + Search Console review (2026-10-23, plan C:\Users\andre\.claude\plans\mighty-greeting-rivest.md)
- GA 28 d to 10-22: 14,649 sessions, 12.5k users; 10-09..15 = 892 sessions vs 10-16..22 = 13,834 (sustained, ~2.2k/day by 10-22). google 8,342, direct 1,974 (40% engaged), bing 1,746, chatgpt 1,114 (best engaged), estadao.com.br 201 (Brazil = 20% of users). New 13k vs returning 1.3k; cohort retention <5%. /p/ landings 14-37 s. Events: download_click 2,193, repo_click 1,717, play_click 624, boot_start 623. `search` fired per keystroke (8,783 from 512 users).
- Search Console 28 d: 6k clicks, 91.7k impressions, CTR 6.5%, avg pos 6.7. Top: driveclub recomp 390/2,842, recomp 270/1,980, infamous recomp 105/497. Low CTR: allrecomps 73/2,677, pinyon shift 17/1,066, driveclub recomp github 15/840, black recomp 22/596, skate 2 recomp 17/353.
- Shipped in code (local): search event debounced once per term (Catalog.astro); /p/ titles now "<name>: <game> PC recomp, download & source"; release age + "Get new releases by RSS" (repo releases.atom, watch_click) + "More like this" (related_click) above the fold on /p/; /releases.xml site-wide release feed (head link + footer); home "N new since your last visit" (localStorage); recompiled list cross-links; llms.txt key pages.
- GA admin done 2026-10-23 (owner approved): key events download_click + play_click; event dimensions Item (item) + Search term (search_term). Pushed ab130cf.
- Re-read ~10-30: /progress/ (4 views on launch day), /p/ engagement, returning share, CTR of the low-CTR queries after the title change.

## Next session (owner, 2026-10-23)
Use Google Analytics (GA4 property p558977824, read through the owner's Chrome) to understand how people use the site, then propose changes for retention, growth and traffic. Baselines and the tracked events (play_click, download_click, repo_click, correction_click; no key events marked yet) are in the "Live" notes above. Measure what /progress/ (launched 2026-10-23) brings.

## Previous next-session (owner, 2026-10-22, done 2026-10-23: see Progress tracker)
Build the most comprehensive public decomp/recomp progress tracker (bytematch/decomp.dev-style, tracking everything): progress sources per entry (objdiff report.json, progress JSON, badges), daily progress snapshots, % bars, progress charts, movers board, milestones. decomp.dev is sunsetting.

## Search Console "not indexed" pass (2026-10-26)
- Live crawl: all 2,720 sitemap URLs 200, canonicals match, no noindex.
- Fixed in code: 25 internal links to /platforms/<x>/ that 404 (tools-only platforms such as python, risc-v, webassembly get no page; /p/ and /game/ crumbs linked them anyway) → `platformHref()` links only when the page exists. /p/ titles shared by same-name repos (AC6Recomp, F-Zero X decomp, Army of Two, Xenosaga, Crackdown...) now carry "by <owner>".
- Owner, Cloudflare dashboard (zone recompsoftware.com): `http://` and `www.` still serve 200 (canonical points to the apex, so Google files them under "Alternate page with proper canonical tag"). SSL/TLS → Edge Certificates → Always Use HTTPS = on; Rules → Redirect Rules → "Redirect from WWW to root" template (301, keep path + query). Trailing-slash redirects from Workers assets are 307: harmless, internal links all carry the slash.
