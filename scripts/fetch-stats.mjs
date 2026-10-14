// Daily GitHub snapshot for every tracked repo -> data/stats/<date>.json + latest.json (with 7/30-day star deltas).
// Token: GITHUB_TOKEN, else `gh auth token`. Usage: node scripts/fetch-stats.mjs [--limit N]
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const DATA = process.env.RECOMP_DATA ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../data');
const STATS = path.join(DATA, 'stats');
const token = process.env.GITHUB_TOKEN || execSync('gh auth token').toString().trim();
const limit = Number(process.argv[process.argv.indexOf('--limit') + 1]) || Infinity;

const keyOf = (url) => url?.match(/github\.com\/([^/]+)\/([^/#?]+)/i);
const repos = new Map();
for (const f of fs.readdirSync(path.join(DATA, 'projects')).filter((f) => f.endsWith('.json'))) {
  for (const p of JSON.parse(fs.readFileSync(path.join(DATA, 'projects', f), 'utf8'))) {
    const m = keyOf(p.repo);
    if (m) repos.set(`${m[1]}/${m[2].replace(/\.git$/, '')}`.toLowerCase(), [m[1], m[2].replace(/\.git$/, '')]);
  }
}
const list = [...repos.entries()].slice(0, limit);
const since = new Date(Date.now() - 30 * 864e5).toISOString();

async function gql(query) {
  const r = await fetch('https://api.github.com/graphql', { method: 'POST', headers: { Authorization: `bearer ${token}`, 'User-Agent': 'recomp-hub' }, body: JSON.stringify({ query }) });
  const j = await r.json();
  return j;
}

const out = {};
let failed = 0;
for (let i = 0; i < list.length; i += 25) {
  const chunk = list.slice(i, i + 25);
  const q = `{ ${chunk.map(([, [o, n]], k) => `r${k}: repository(owner: ${JSON.stringify(o)}, name: ${JSON.stringify(n)}) { stargazerCount pushedAt isArchived latestRelease { tagName publishedAt } defaultBranchRef { target { ... on Commit { history(since: ${JSON.stringify(since)}) { totalCount } } } } }`).join('\n')} }`;
  const j = await gql(q);
  chunk.forEach(([key], k) => {
    const r = j.data?.[`r${k}`];
    if (!r) { failed++; return; }
    out[key] = {
      stars: r.stargazerCount, pushedAt: r.pushedAt, archived: r.isArchived,
      release: r.latestRelease ? { version: r.latestRelease.tagName, date: r.latestRelease.publishedAt } : null,
      commits30: r.defaultBranchRef?.target?.history?.totalCount ?? null,
    };
  });
}

// Until real snapshots exist, count recent stars from the newest stargazer pages (REST star+json gives starred_at;
// GraphQL stargazers is refused for fine-grained tokens). REST pagination stops at 40k stars.
async function recentStars(key, stars) {
  const last = Math.ceil(stars / 100);
  if (!stars || last > 400) return { recent7: null, recent30: null };
  const times = [];
  for (let page = last; page >= Math.max(1, last - 2); page--) {
    const r = await fetch(`https://api.github.com/repos/${key}/stargazers?per_page=100&page=${page}`, { headers: { Authorization: `bearer ${token}`, Accept: 'application/vnd.github.star+json', 'User-Agent': 'recomp-hub' } });
    if (!r.ok) return { recent7: null, recent30: null }; // 403 for fine-grained PATs: deltas wait for real snapshots
    const j = await r.json();
    times.push(...j.map((x) => Date.parse(x.starred_at)));
    if (Math.min(...j.map((x) => Date.parse(x.starred_at))) < Date.now() - 30 * 864e5) break;
  }
  return { recent7: times.filter((t) => t > Date.now() - 7 * 864e5).length, recent30: times.filter((t) => t > Date.now() - 30 * 864e5).length };
}

const today = new Date().toISOString().slice(0, 10);
fs.mkdirSync(STATS, { recursive: true });
fs.writeFileSync(path.join(STATS, `${today}.json`), JSON.stringify(out));

// Deltas against the newest snapshot at least N days old.
const snaps = fs.readdirSync(STATS).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort();
const older = (days) => {
  const cut = new Date(Date.now() - days * 864e5).toISOString().slice(0, 10);
  const f = [...snaps].reverse().find((s) => s.slice(0, 10) <= cut);
  return f ? JSON.parse(fs.readFileSync(path.join(STATS, f), 'utf8')) : null;
};
const w = older(7), m = older(30);
if (!w || !m) for (const [k, v] of Object.entries(out)) Object.assign(v, await recentStars(k, v.stars));
const reposOut = {};
for (const [k, v] of Object.entries(out)) {
  const { recent7, recent30, ...rest } = v;
  reposOut[k] = { ...rest, starsWeek: w?.[k] ? v.stars - w[k].stars : recent7, starsMonth: m?.[k] ? v.stars - m[k].stars : recent30 };
}
fs.writeFileSync(path.join(STATS, 'latest.json'), JSON.stringify({ date: today, repos: reposOut }, null, 0));
// Keep 120 days of daily snapshots.
for (const f of snaps.slice(0, Math.max(0, snaps.length - 120))) fs.unlinkSync(path.join(STATS, f));
console.log(`fetch-stats: ${Object.keys(out).length}/${list.length} repos, ${failed} failed, deltas from ${w ? '7d' : 'no 7d'} / ${m ? '30d' : 'no 30d'} snapshot`);
