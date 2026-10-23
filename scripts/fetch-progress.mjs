// Daily decomp progress for every tracked repo -> data/progress/latest.json + history.json (+ scan.json, the fetch cache).
// Sources, best first: ByteMatch API, decomp.dev per-project JSON, frogress (progress.deco.mp), the objdiff report in a
// repo's own Actions artifacts, README progress badges, then the hand-entered `progress` field.
// Only the first three are "ranked": their maintainers opted into public tracking, so only they feed movers/leaderboards.
// Entries with progressOptOut are skipped. Token: GITHUB_TOKEN, else `gh auth token`.
// Usage: node scripts/fetch-progress.mjs [--limit N] [--discover]   (--discover asks decomp.dev about every decomp repo)
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const DATA = process.env.RECOMP_DATA ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../data');
const DIR = path.join(DATA, 'progress');
const token = process.env.GITHUB_TOKEN || execSync('gh auth token').toString().trim();
const arg = (k) => process.argv.indexOf(k);
const limit = Number(process.argv[arg('--limit') + 1]) || Infinity;
const discover = arg('--discover') > 0;
const today = new Date().toISOString().slice(0, 10);
const UA = { 'User-Agent': 'recompsoftware.com progress tracker' };
const RANKED = new Set(['bytematch', 'decompdev', 'frogress']);
const DECOMP = new Set(['matching-decomp', 'non-matching-decomp', 'lift']);
const RESCAN_DAYS = 7;

const readJson = (f, fb) => { try { return JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')); } catch { return fb; } };
const keyOf = (url) => url?.match(/github\.com\/([^/]+)\/([^/#?]+)/i);
const daysSince = (d) => (d ? (Date.parse(today) - Date.parse(d)) / 864e5 : Infinity);

// Catalogue: one row per GitHub repo (several entries can share one).
const cat = new Map();
for (const f of fs.readdirSync(path.join(DATA, 'projects')).filter((f) => f.endsWith('.json'))) {
  for (const p of JSON.parse(fs.readFileSync(path.join(DATA, 'projects', f), 'utf8'))) {
    const m = keyOf(p.repo);
    if (!m) continue;
    const key = `${m[1]}/${m[2].replace(/\.git$/, '')}`.toLowerCase();
    const row = cat.get(key) ?? { key, slugs: [], methods: new Set(), optOut: false, manual: null, links: [] };
    row.slugs.push(p.slug);
    row.methods.add(p.method);
    row.optOut ||= !!p.progressOptOut;
    if (p.progress != null) row.manual ??= { pct: p.progress, url: p.progressSource ?? null };
    row.links.push(p.progressSource, ...(p.sources ?? []));
    cat.set(key, row);
  }
}
const rows = [...cat.values()].filter((r) => !r.optOut).slice(0, limit);
const optedOut = [...cat.values()].filter((r) => r.optOut).length;

const prev = readJson('latest.json', { repos: {} });
const history = readJson('history.json', {});
const scan = readJson('scan.json', {});
const fmap = Object.fromEntries(Object.entries(readJson('frogress-map.json', {})).filter(([k]) => !k.startsWith('_')));

const found = new Map(); // key -> latest record
const fails = {};
const fail = (src) => { fails[src] = (fails[src] ?? 0) + 1; };

async function pool(items, n, fn) {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) await fn(items[i++]); }));
}
async function getJson(url, headers = {}) {
  for (let t = 0; t < 2; t++) {
    try {
      const r = await fetch(url, { headers: { ...UA, ...headers } });
      if (r.status === 404 || r.status === 410) return null;
      if (r.ok) return await r.json();
    } catch {}
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error(`fetch failed ${url}`);
}
let ghBlocked = false; // once rate-limited, the GitHub-based sources stop for this run
async function gh(pathname, accept = 'application/vnd.github+json') {
  if (ghBlocked) return { blocked: true };
  const r = await fetch(`https://api.github.com${pathname}`, { headers: { ...UA, Authorization: `bearer ${token}`, Accept: accept } });
  if (r.status === 403 || r.status === 429) { if (r.headers.get('x-ratelimit-remaining') === '0' || r.status === 429) ghBlocked = true; return { status: r.status }; }
  if (!r.ok) return { status: r.status };
  return { body: accept.includes('raw') ? await r.text() : await r.json() };
}

// objdiff measures arrive snake_case (decomp.dev, ByteMatch, report.json) or camelCase (proto JSON); u64s may be strings.
const num = (m, k) => {
  const v = m?.[k] ?? m?.[k.replace(/_(\w)/g, (_, c) => c.toUpperCase())];
  return v == null ? null : Number(v);
};
const round = (x) => (x == null || Number.isNaN(x) ? null : Math.round(Math.min(100, Math.max(0, x)) * 100) / 100);
function fromMeasures(m) {
  const code = round(num(m, 'matched_code_percent'));
  const fuzzy = round(num(m, 'fuzzy_match_percent'));
  return {
    pct: code ?? fuzzy, codePct: code, fuzzyPct: fuzzy,
    matchedFns: num(m, 'matched_functions'), totalFns: num(m, 'total_functions'),
    linkedPct: round(num(m, 'complete_code_percent')),
  };
}
const dateOf = (t) => (t ? new Date(typeof t === 'number' ? t * 1000 : t).toISOString().slice(0, 10) : today);

// One point per day, and only when the value moved. Leading zeros are dropped: early decomp.dev history often has
// empty measures (melee shows 0% in 2021), and a project's chart should start at its first real figure.
function compress(points) {
  const byDay = new Map();
  const sorted = points.filter((p) => p[1] != null).sort((a, b) => a[0].localeCompare(b[0]));
  const first = sorted.findIndex((p) => p[1] > 0);
  for (const p of first < 0 ? sorted.slice(-1) : sorted.slice(first)) byDay.set(p[0], p);
  const out = [];
  for (const p of byDay.values()) { const l = out[out.length - 1]; if (!l || l[1] !== p[1] || l[2] !== p[2]) out.push(p); }
  return out;
}
function record(key, rec, seed) {
  if (rec.pct == null) return;
  found.set(key, { ...rec, ranked: RANKED.has(rec.source), checked: today });
  const h = history[key];
  const point = [rec.at, rec.pct, rec.matchedFns ?? null];
  if (seed?.length || !h || h.source !== rec.source) history[key] = { source: rec.source, points: compress([...(seed ?? []), point]) };
  else h.points = compress([...h.points, point]);
}

// 1. ByteMatch: the whole opted-in list in one or two requests.
const unmatched = [];
async function byteMatch() {
  const list = [];
  for (let page = 1; page < 20; page++) {
    const j = await getJson(`https://bytematch.dev/api/v1/projects?per_page=500&page=${page}`).catch(() => (fail('bytematch'), null));
    if (!j?.length) break;
    list.push(...j);
    if (j.length < 500) break;
  }
  const mine = list.filter((x) => { const k = `${x.owner}/${x.repo}`.toLowerCase(); if (!cat.has(k)) unmatched.push(`bytematch ${k}`); return rows.some((r) => r.key === k); });
  await pool(mine, 6, async (x) => {
    const key = `${x.owner}/${x.repo}`.toLowerCase();
    const url = `https://bytematch.dev/${x.owner}/${x.repo}`;
    let seed;
    if (history[key]?.source !== 'bytematch') {
      const h = await getJson(`${url}.json?mode=history`).catch(() => null);
      seed = (Array.isArray(h) ? h : []).map((e) => { const f = fromMeasures(e.measures); return [dateOf(e.timestamp), f.pct, f.matchedFns]; });
    }
    record(key, { ...fromMeasures(x.measures), version: x.version ?? null, source: 'bytematch', sourceUrl: url, at: dateOf(x.timestamp) }, seed);
  });
  return list.length;
}

// 2. decomp.dev: its index is gone (projects.json = 410), so ask per repo we know or suspect is there.
async function decompDev(key, owner, repo) {
  const url = `https://decomp.dev/${owner}/${repo}`;
  const j = await getJson(`${url}.json`).catch(() => (fail('decompdev'), undefined));
  if (j === undefined) { // unreachable: keep the last value we had rather than dropping the project
    if (prev.repos[key]?.source === 'decompdev') found.set(key, prev.repos[key]);
    return true;
  }
  if (!j?.measures) return false;
  let seed;
  if (history[key]?.source !== 'decompdev') {
    const h = await getJson(`${url}.json?mode=history`).catch(() => null);
    seed = (Array.isArray(h) ? h : []).map((e) => { const f = fromMeasures(e.measures); return [dateOf(e.timestamp), f.pct, f.matchedFns]; });
  }
  record(key, { ...fromMeasures(j.measures), version: j.default_version ?? null, source: 'decompdev', sourceUrl: url, commit: j.commit?.sha?.slice(0, 10) ?? null, at: dateOf(j.commit?.timestamp) }, seed);
  return true;
}

// 3. frogress: latest points for every project in one request; full history once per newly mapped project.
const frogressPct = (m) => {
  const k = ['all', 'code', ...Object.keys(m).filter((x) => !x.includes('/'))].find((x) => m[x] != null && m[`${x}/total`]);
  return k ? round((100 * m[k]) / m[`${k}/total`]) : null;
};
async function frogress(slug, map, all) {
  const latest = all?.[slug]?.[map.version]?.[map.category]?.[0];
  if (!latest) return false;
  const base = `https://progress.deco.mp/data/${slug}/${map.version}/${map.category}/`;
  let seed;
  if (history[map.repo]?.source !== 'frogress') {
    const h = await getJson(`${base}?mode=all`).catch(() => null);
    seed = (h?.[slug]?.[map.version]?.[map.category] ?? []).map((e) => [dateOf(e.timestamp), frogressPct(e.measures), null]);
  }
  const pct = frogressPct(latest.measures);
  if (pct == null) return false;
  record(map.repo, { pct, codePct: pct, fuzzyPct: null, matchedFns: null, totalFns: null, linkedPct: null, version: map.version, source: 'frogress', sourceUrl: `https://progress.deco.mp/data/${slug}/${map.version}/${map.category}/?mode=shield`, commit: latest.git_hash?.slice(0, 10) ?? null, at: dateOf(latest.timestamp) }, seed);
  return true;
}

// 4. The repo's own objdiff report: newest unexpired *_report artifact built on the repo itself (not a fork PR).
function unzipEntry(buf, want) {
  let eocd = buf.length - 22;
  while (eocd >= 0 && buf.readUInt32LE(eocd) !== 0x06054b50) eocd--;
  if (eocd < 0) return null;
  let p = buf.readUInt32LE(eocd + 16);
  for (let n = buf.readUInt16LE(eocd + 10); n > 0; n--) {
    const method = buf.readUInt16LE(p + 10), size = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28), extra = buf.readUInt16LE(p + 30), comment = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    if (want.test(name)) {
      const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
      const data = buf.subarray(start, start + size);
      return { name, data: method === 8 ? zlib.inflateRawSync(data) : data };
    }
    p += 46 + nameLen + extra + comment;
  }
  return null;
}
const PREFER = /(^|[_-])(us|usa|ntsc|ntsc-u|[A-Z0-9]{3}E[0-9]{2}(_\d+)?)(_report)?$/i;
async function artifact(key) {
  const r = await gh(`/repos/${key}/actions/artifacts?per_page=100`);
  if (!r.body) { if (r.status && r.status !== 404) fail('artifact'); return 'none'; }
  const arts = r.body.artifacts.filter((a) => !a.expired && /report/i.test(a.name) && a.size_in_bytes < 60e6
    && a.workflow_run?.head_repository_id === a.workflow_run?.repository_id && /^(main|master|dev|develop|trunk)$/.test(a.workflow_run?.head_branch ?? ''));
  if (!arts.length) return 'none';
  const run = arts[0].workflow_run.id;
  const same = arts.filter((a) => a.workflow_run.id === run);
  const pick = same.find((a) => a.name === scan[key]?.artifactName) ?? same.find((a) => PREFER.test(a.name)) ?? same[0];
  const old = prev.repos[key];
  if (old?.source === 'artifact' && old.artifactId === pick.id) { found.set(key, { ...old, checked: today }); return 'kept'; }
  const z = await fetch(`https://api.github.com/repos/${key}/actions/artifacts/${pick.id}/zip`, { headers: { ...UA, Authorization: `bearer ${token}` } });
  if (!z.ok) { fail('artifact-download'); if (old?.source === 'artifact') found.set(key, old); return 'none'; }
  const entry = unzipEntry(Buffer.from(await z.arrayBuffer()), /report\.(json|binpb)$/i);
  if (!entry) return 'none';
  if (entry.name.endsWith('.binpb')) { fail('artifact-binpb'); return 'none'; }
  let j;
  try { j = JSON.parse(entry.data.toString('utf8')); } catch { fail('artifact-json'); return 'none'; }
  const f = fromMeasures(j.measures ?? j);
  if (f.pct == null) return 'none';
  scan[key] = { ...scan[key], artifactName: pick.name };
  record(key, { ...f, version: pick.name.replace(/[_-]?report$/i, '') || null, source: 'artifact', sourceUrl: `https://github.com/${key}/actions/runs/${run}`, commit: pick.workflow_run.head_sha?.slice(0, 10) ?? null, artifactId: pick.id, at: dateOf(pick.created_at) });
  return 'found';
}

// 5. README badges. Badges pointing at an aggregator are followed to it (that project opted in there).
async function badge(key) {
  const r = await gh(`/repos/${key}/readme`, 'application/vnd.github.raw');
  if (!r.body) return null;
  const urls = [...r.body.matchAll(/https?:\/\/[^\s)"'<>\]]+/g)].map((m) => m[0].replace(/&amp;/g, '&'));
  for (let u of urls) {
    const ep = u.match(/img\.shields\.io\/endpoint\?(?:.*&)?url=([^&]+)/i);
    if (ep) u = decodeURIComponent(ep[1]);
    const agg = u.match(/^https?:\/\/(decomp\.dev|bytematch\.dev)\/([^/?#]+)\/([^/?#.]+)/i);
    if (agg && agg[1].toLowerCase() === 'decomp.dev') { if (await decompDev(key, agg[2], agg[3])) return 'aggregator'; continue; }
    if (agg) {
      const j = await getJson(`https://bytematch.dev/${agg[2]}/${agg[3]}.json`).catch(() => null);
      if (j?.measures) { record(key, { ...fromMeasures(j.measures), version: j.default_version ?? null, source: 'bytematch', sourceUrl: `https://bytematch.dev/${agg[2]}/${agg[3]}`, at: dateOf(j.commit?.timestamp) }); return 'aggregator'; }
      continue;
    }
    const fr = u.match(/progress\.(?:deco\.mp|decomp\.club)\/data\/([^/]+)\/([^/]+)\/([^/?]+)/i);
    if (fr) {
      // READMEs copied from a template keep its badge: only map a slug that looks like this repo.
      const loose = (x) => x.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (!fmap[fr[1]] && (loose(key).includes(loose(fr[1])) || loose(fr[1]).includes(loose(key.split('/')[1])))) fmap[fr[1]] = { repo: key, version: fr[2], category: fr[3] };
      if (!fmap[fr[1]]) unmatched.push(`frogress badge ${fr[1]} in ${key} (not mapped)`);
      if (fmap[fr[1]]?.repo === key && await frogress(fr[1], fmap[fr[1]], await frogressAll())) return 'aggregator';
      continue;
    }
    let pct = null;
    if (ep) {
      const j = await getJson(u).catch(() => null);
      const m = typeof j?.message === 'string' && j.message.match(/(\d+(?:\.\d+)?)\s*%/);
      if (m && /progress|decomp|match|code|complete|done/i.test(`${j.label ?? ''}`)) pct = Number(m[1]);
    } else if (/img\.shields\.io\/badge\//i.test(u)) {
      const s = decodeURIComponent(u.split('/badge/')[1].split(/[?.]svg|\?/)[0]).replace(/--/g, '\u0000');
      const m = s.match(/(\d+(?:\.\d+)?)\s*%/);
      if (m && /progress|decomp|match|code|complete|done/i.test(s.split('-')[0])) pct = Number(m[1]);
    } else if (/progress[^/]*\.svg(\?|$)/i.test(u)) {
      const t = await fetch(u, { headers: UA }).then((x) => (x.ok ? x.text() : '')).catch(() => '');
      const m = t.match(/>\s*(\d+(?:\.\d+)?)\s*%\s*</);
      if (m) pct = Number(m[1]);
    }
    if (pct != null && pct >= 0 && pct <= 100) {
      record(key, { pct: round(pct), codePct: null, fuzzyPct: null, matchedFns: null, totalFns: null, linkedPct: null, version: null, source: 'badge', sourceUrl: ep ? u : `https://github.com/${key}#readme`, at: today });
      return 'badge';
    }
  }
  return null;
}
let frogressCache;
const frogressAll = async () => (frogressCache ??= await getJson('https://progress.deco.mp/data/').catch(() => (fail('frogress'), {})));

// Run the sources in order; each only looks at repos nothing better has covered yet.
const bmTotal = await byteMatch();
const open = () => rows.filter((r) => !found.has(r.key));

const ddLinked = (r) => r.links.some((u) => u?.toLowerCase().includes(`decomp.dev/${r.key}`));
const ddCand = open().filter((r) => prev.repos[r.key]?.source === 'decompdev' || ddLinked(r) || (discover && [...r.methods].some((m) => DECOMP.has(m))));
await pool(ddCand, 6, async (r) => { const [o, n] = r.key.split('/'); await decompDev(r.key, o, n); });

const all = await frogressAll();
for (const [slug, map] of Object.entries(fmap)) {
  if (!cat.has(map.repo)) { unmatched.push(`frogress ${slug} -> ${map.repo} (not in catalogue)`); continue; }
  if (!found.has(map.repo) && rows.some((r) => r.key === map.repo)) await frogress(slug, map, all);
}
for (const slug of Object.keys(all)) if (!fmap[slug]) unmatched.push(`frogress ${slug} (unmapped)`);

// GitHub-based sources only for decomp-type repos, and only re-asked weekly once a repo turned out to have nothing.
const ghCand = open().filter((r) => [...r.methods].some((m) => DECOMP.has(m)));
const counts = { artifactsAsked: 0, readmesAsked: 0 };
await pool(ghCand, 4, async (r) => {
  const s = (scan[r.key] ??= {});
  if (s.artifacts !== 'none' || daysSince(s.artifactsAt) >= RESCAN_DAYS) {
    counts.artifactsAsked++;
    const res = await artifact(r.key);
    if (!ghBlocked) Object.assign(s, { artifacts: res === 'none' ? 'none' : 'yes', artifactsAt: today });
    if (res !== 'none') return;
  }
  if (found.has(r.key)) return;
  if (s.badge || daysSince(s.readmeAt) >= RESCAN_DAYS) {
    counts.readmesAsked++;
    const res = await badge(r.key);
    if (!ghBlocked) Object.assign(s, { badge: res, readmeAt: today });
  } else if (prev.repos[r.key]?.source === 'badge') found.set(r.key, prev.repos[r.key]);
});

for (const r of open()) if (r.manual) record(r.key, { pct: round(r.manual.pct), codePct: null, fuzzyPct: null, matchedFns: null, totalFns: null, linkedPct: null, version: null, source: 'manual', sourceUrl: r.manual.url, at: prev.repos[r.key]?.at ?? today });

// A badge URL shared by several repos is a template leftover, not their progress.
const badgeUrls = {};
for (const [k, v] of found) if (v.source === 'badge' && !v.sourceUrl.includes('#readme')) (badgeUrls[v.sourceUrl] ??= []).push(k);
for (const ks of Object.values(badgeUrls)) if (ks.length > 1) for (const k of ks) { found.delete(k); delete history[k]; unmatched.push(`badge shared by ${ks.join(', ')}`); }

// Opted-out or removed repos leave the data entirely.
for (const k of Object.keys(history)) if (!cat.has(k) || cat.get(k).optOut) delete history[k];
if (limit !== Infinity) for (const [k, v] of Object.entries(prev.repos)) if (!found.has(k) && cat.has(k) && !cat.get(k).optOut && !rows.some((r) => r.key === k)) found.set(k, v);

fs.mkdirSync(DIR, { recursive: true });
const sorted = (o) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)));
fs.writeFileSync(path.join(DIR, 'latest.json'), JSON.stringify({ date: today, repos: sorted(Object.fromEntries(found)) }));
fs.writeFileSync(path.join(DIR, 'history.json'), JSON.stringify(sorted(history)));
fs.writeFileSync(path.join(DIR, 'scan.json'), JSON.stringify(sorted(scan)));
const mapNote = readJson('frogress-map.json', {})._note;
fs.writeFileSync(path.join(DIR, 'frogress-map.json'), JSON.stringify({ _note: mapNote, ...fmap }, null, 2) + '\n');
fs.mkdirSync(path.join(DATA, '../.cache'), { recursive: true });
fs.writeFileSync(path.join(DATA, '../.cache/progress-unmatched.txt'), unmatched.join('\n') + '\n');

const by = {};
for (const v of found.values()) by[v.source] = (by[v.source] ?? 0) + 1;
const pts = Object.values(history).reduce((a, h) => a + h.points.length, 0);
console.log(`fetch-progress: ${found.size} repos with progress of ${rows.length} (${optedOut} opted out) · ${Object.entries(by).map(([k, v]) => `${k} ${v}`).join(', ')}`);
console.log(`  ByteMatch lists ${bmTotal} · asked GitHub: ${counts.artifactsAsked} artifact lists, ${counts.readmesAsked} READMEs${ghBlocked ? ' · RATE-LIMITED, rest skipped' : ''}`);
console.log(`  history: ${Object.keys(history).length} series, ${pts} points · failures: ${JSON.stringify(fails)} · ${unmatched.length} leads in .cache/progress-unmatched.txt`);
