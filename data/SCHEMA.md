# Recomp hub data schema

One JSON array per section in `data/projects/<category>.json`. Facts and links only, summaries in our own words (never copy a README or article's prose).

```jsonc
{
  "slug": "zelda64recomp",                 // kebab-case, unique across all files
  "name": "Zelda 64: Recompiled",          // the project's own official name
  "category": "games",                     // games | apps | os | tools | preservation
  "subject": "The Legend of Zelda: Majora's Mask", // the original software (tools: what it targets, e.g. "N64 MIPS binaries")
  "originalPlatform": "Nintendo 64",       // platform of the original ("Windows", "Xbox 360", "Multi")
  "originalYear": 2000,                    // year the original came out (null for tools)
  "method": "static-recomp",               // matching-decomp | non-matching-decomp | static-recomp | clean-room | rewrite | source-port | source-release | lift | emulation-hosted | tool
  "status": "released",                    // released | complete | wip | stalled | archived
  "progress": null,                        // 0-100 if the project publishes a % (matching decomp), else null
  "progressSource": null,                  // URL of that %
  "progressOptOut": false,                 // optional: true = the maintainer asked us not to show progress (scripts/fetch-progress.mjs skips it)
  "provenance": "human-led",               // human-led | ai-assisted | ai-generated | unknown  (ONLY from the project's own statements or clear public reporting; default "unknown")
  "provenanceNote": null,                  // one line + where it is stated, when not "unknown"
  "licence": "GPL-3.0",                    // SPDX id from GitHub, "none" if no licence file, "unknown"
  "repo": "https://github.com/Zelda64Recomp/Zelda64Recomp",
  "website": null,
  "discord": null,                         // public invite link only if the project itself publishes it
  "subreddit": null,
  "team": ["Wiseguy", "dcvz"],             // public handles / orgs credited by the project
  "started": "2023",                       // YYYY or YYYY-MM
  "firstRelease": "2024-05",
  "latestRelease": { "version": "1.2.2", "date": "2026-08-27" }, // from GitHub releases, or null
  "targets": ["Windows", "Linux", "macOS"],// where the result runs
  "needsOriginal": true,                   // user must supply their own copy of the original
  "playable": null,                        // or { "tier": "cleanroom|free|byo|software", "url": "...", "launch": "frame|tab", "note": "licence reason it may be hosted" }
  "summary": "Native PC port of Majora's Mask built with N64: Recompiled ...", // 1-2 sentences, our words
  "tags": ["n64", "zelda", "mods"],
  "sources": ["https://github.com/Zelda64Recomp/Zelda64Recomp"], // where each fact was checked
  "checked": "2026-10-13"
}
```

History: `data/history.json` = `[{ "id", "label", "blurb", "events": [{ "date": "YYYY[-MM[-DD]]", "title", "body", "who", "source": "url", "projects": ["slug"] }] }]`.

Lineage: `data/lineage.json` = `[{ "slug", "parents": ["slug"], "relation": "built-on | fork-of | inspired-by | uses-tool" }]`.

Progress (written daily by `scripts/fetch-progress.mjs`, never by hand except `frogress-map.json`):
- `data/progress/latest.json` = `{ "date", "repos": { "owner/repo": { "pct", "codePct", "fuzzyPct", "linkedPct", "matchedFns", "totalFns", "version", "source", "sourceUrl", "ranked", "commit", "at", "checked" } } }`. `source` is bytematch | decompdev | frogress | artifact | badge | manual; `ranked` is true only for the first three (maintainer opted in), and only ranked repos go on movers boards, leaderboards and milestones.
- `data/progress/history.json` = `{ "owner/repo": { "source", "points": [["YYYY-MM-DD", pct, matchedFns|null]] } }`, one point per day, only when the value changed; seeded from the aggregator's own history.
- `data/progress/scan.json` = fetch cache (which repos have report artifacts or README badges; rechecked weekly when empty).
- `data/progress/frogress-map.json` = progress.deco.mp slug -> `{ repo, version, category }`, hand-checked; README badges add entries.
