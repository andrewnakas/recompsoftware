<div align="center">

# &lt;recomp/&gt;

**Every decompilation, static recompilation, clean-room rebuild and preservation project, tracked live.**

### [recompsoftware.com](https://recompsoftware.com)

[Browse all projects](https://recompsoftware.com/projects/) · [Recompiled games list](https://recompsoftware.com/recompiled-games-list/) · [Decompiled games list](https://recompsoftware.com/decompiled-games-list/) · [Progress tracker](https://recompsoftware.com/progress/) · [Play in your browser](https://recompsoftware.com/play/) · [Submit a project](https://recompsoftware.com/submit/)

</div>

---

Recomp is a community tracker for the projects that rebuild software from its machine code: N64 games recompiled into native PC ports, byte-matching GameCube decompilations, open-source reimplementations of classic apps, revived online servers, and the reverse-engineering tools the scene runs on. It covers **2,300+ projects** across games, apps, operating systems, RE tooling and preservation, and it updates itself every day from GitHub and the scene's progress trackers.

Every entry says how the project was made and who made it, including an honest label for AI use, taken from the project's own words.

## What's on the site

| Page | What you get |
|---|---|
| [**Games**](https://recompsoftware.com/games/), [Apps](https://recompsoftware.com/apps/), [OS](https://recompsoftware.com/os/), [Tools](https://recompsoftware.com/tools/), [Preservation](https://recompsoftware.com/preservation/) | The full catalogue by section, searchable and filterable by method, platform and provenance |
| [**Recompiled games list**](https://recompsoftware.com/recompiled-games-list/) | Every static recomp / native PC port, with download links to the latest release |
| [**Decompiled games list**](https://recompsoftware.com/decompiled-games-list/) | Every game decompilation and how far along it is |
| [**Progress tracker**](https://recompsoftware.com/progress/) | Matched-code % for ~275 decomps, history charts, weekly movers, milestones and per-platform leaderboards |
| [**Platforms**](https://recompsoftware.com/platforms/) | One page per console or system: *"N64 decomps, recomps & PC ports: full list"* |
| [**By game**](https://recompsoftware.com/game/) | Comparison pages for games that have several projects (e.g. [Super Mario 64](https://recompsoftware.com/game/super-mario-64/)) |
| [**Trending**](https://recompsoftware.com/trending/) · [This week](https://recompsoftware.com/this-week/) | What is gaining stars and shipping releases right now |
| [**Play**](https://recompsoftware.com/play/) | Builds that run in a browser tab: clean-room ROM-free builds, free originals, bring-your-own-file ports and software in WebAssembly |
| [**News**](https://recompsoftware.com/news/) · [History](https://recompsoftware.com/history/) · [Tool lineage](https://recompsoftware.com/lineage/) | Scene news, a timeline from the 1990s to now, and which tools grew out of which |
| [**What is a recomp?**](https://recompsoftware.com/what-is-a-recomp/) | Decompilation vs static recompilation vs clean-room reimplementation, in plain words |

Each project page ([example](https://recompsoftware.com/p/zelda64recomp/)) shows:

- the status, method and platform
- the provenance label and licence
- the latest release, with a download button
- GitHub activity and star growth
- a progress chart, where one exists
- related projects

**Feeds:** [new releases (RSS)](https://recompsoftware.com/releases.xml) · [news (RSS)](https://recompsoftware.com/news/rss.xml) · [llms.txt](https://recompsoftware.com/llms.txt)

## Labels

**Method:**

- matching decomp
- decompilation
- static recomp
- clean-room
- rewrite
- source port
- official source release
- binary lift
- emulation-hosted
- tool

**Status:** released · complete · wip · stalled · archived. Status keeps itself current:

- a decomp that reaches 100% on its progress source becomes *complete*
- a WIP port that publishes a GitHub release becomes *released*
- an archived repo becomes *archived*

**Provenance:**

| Label | When |
|---|---|
| Human-led | The project says so, or predates practical AI coding tools |
| AI-assisted | The project says AI helped (README, CLAUDE.md/AGENTS.md, commit trailers, its own site) |
| AI-generated | The project says the work was done primarily by AI |
| Not stated | No statement from the project. Speculation from elsewhere never sets a label |

## Rules for listing

Recomp lists projects whose repositories and releases contain **their own work only**:

- **No hosted IP:** no ROMs, ISOs, disc images, retail executables, DLLs, or game assets (extracted, converted or AI-upscaled) in the repo or its releases.
- **Bring your own copy:** projects that need the original must have players supply it from a copy they own.
- **No leaked source.**
- **Public, primary sources:** every fact on a page links to where it was checked.
- **Our own words:** summaries are written fresh, never copied from READMEs.

The site itself hosts no ROMs, disc images or ripped assets and does not link to any.

Submissions are verified before they go live:

1. Scan the repo's file tree for game files.
2. Check what the releases ship.
3. Check how release binaries were built and look up their hashes.
4. Find the AI-use statement, if any.

## Submit a project or a correction

- **New project:** use the [Submit a project](https://recompsoftware.com/submit/) form, or [open a submission issue](https://github.com/andrewnakas/recompsoftware/issues/new/choose).
- **Something wrong or stale?** Use the correction form linked from every project page. Maintainers saying "I work on this" get priority.
- **Want progress tracking?** Publish your progress on [ByteMatch](https://bytematch.dev), decomp.dev or frogress (opt-in sources are ranked on the leaderboards). An objdiff `*_report` CI artifact or a README badge is also picked up, shown but not ranked. Ask to opt out and your entry's progress disappears everywhere.

## How it stays current

A [scheduled workflow](.github/workflows/site.yml) runs every day at 05:23 UTC, with a catch-up rebuild every 6 hours:

1. **`scripts/fetch-stats.mjs`** snapshots stars, pushes, releases and archived flags for every tracked GitHub repo (`data/stats/`).
2. **`scripts/fetch-progress.mjs`** reads matched-code % from, in priority order:
   1. ByteMatch
   2. decomp.dev
   3. frogress
   4. the projects' own progress pages and CI reports
   5. README badges

   It writes `data/progress/`.
3. **Pictures** refresh on Mondays (`scripts/fetch-media.mjs`).
4. The Astro site builds (~2,700 static pages), deploys to Cloudflare Workers, and pings IndexNow.

New projects come from scene sweeps (`scripts/intel/`: GitHub search, Reddit, news feeds, Hacker News, lobste.rs) and from submissions. Every candidate is reviewed by hand before it is merged.

## Repository layout

```
apps/web/            Astro 5 static site (pages in src/pages, data access in src/lib/data.ts)
data/projects/       the catalogue: games.json, apps.json, os.json, tools.json, preservation.json
data/SCHEMA.md       field-by-field schema for every entry
data/stats/          daily GitHub snapshots (latest.json + one file per day)
data/progress/       daily decomp progress + history
data/news.json       published news   ·   data/history.json   timeline   ·   data/lineage.json   tool family tree
scripts/             validate, fetch-stats, fetch-progress, fetch-media, og cards, IndexNow, scene sweeps
apps/cron/           Cloudflare cron worker (hosting move, see STATUS.md)
```

## Run it locally

Requires Node 22.12+.

```sh
cd apps/web
npm ci
npm run dev            # http://localhost:4321
npm run build          # validate the data + build every page into apps/web/dist
node ../../scripts/validate.mjs   # just check the catalogue
```

To add an entry by hand, append it to the right `data/projects/*.json` following [`data/SCHEMA.md`](data/SCHEMA.md), run `validate.mjs`, and open a pull request.

## Network

Recomp's sister sites:

- [decompgames.com](https://decompgames.com)
- [skatemods.com](https://skatemods.com)
- [aigamemashups.com](https://aigamemashups.com)

Not affiliated with any publisher, platform holder or listed project. Game and product names belong to their owners.
