// Build-time access to the catalogue in the repo-root data/ folder (see data/SCHEMA.md).
import fs from 'node:fs';
import path from 'node:path';

const DATA = process.env.RECOMP_DATA ?? path.resolve(process.cwd(), '../../data');

export type Category = 'games' | 'apps' | 'os' | 'tools' | 'preservation';
export type Method =
  | 'matching-decomp' | 'non-matching-decomp' | 'static-recomp' | 'clean-room' | 'rewrite'
  | 'source-port' | 'source-release' | 'lift' | 'emulation-hosted' | 'tool';
export type Provenance = 'human-led' | 'ai-assisted' | 'ai-generated' | 'unknown';

export interface Playable { tier: 'cleanroom' | 'free' | 'byo' | 'software'; url: string; launch: 'frame' | 'tab'; note: string }
export interface Project {
  slug: string; name: string; category: Category; subject: string; originalPlatform: string;
  originalYear: number | null; method: Method; status: string; progress: number | null;
  progressSource: string | null; provenance: Provenance; provenanceNote: string | null;
  licence: string; repo: string | null; website: string | null; discord: string | null;
  subreddit: string | null; team: string[]; started: string | null; firstRelease: string | null;
  latestRelease: { version: string; date: string } | null; targets: string[]; needsOriginal: boolean;
  playable: Playable | null; summary: string; tags: string[]; sources: string[]; checked: string;
}
export interface Stats {
  stars: number; starsWeek: number | null; starsMonth: number | null; commits30: number | null;
  pushedAt: string | null; release: { version: string; date: string } | null; archived: boolean;
}
export interface HistoryEvent { date: string; title: string; body: string; who?: string; source: string; projects?: string[] }
export interface HistoryEra { id: string; label: string; blurb?: string; events: HistoryEvent[] }
export interface NewsItem { date: string; title: string; body: string; source: string; projects?: string[]; kind?: string }

const read = <T>(rel: string, fallback: T): T => {
  const f = path.join(DATA, rel);
  return fs.existsSync(f) ? (JSON.parse(fs.readFileSync(f, 'utf8')) as T) : fallback;
};

export const CATEGORIES: { id: Category; label: string; blurb: string }[] = [
  { id: 'games', label: 'Games', blurb: 'Decompilations, static recompilations, source ports and clean-room rebuilds of games.' },
  { id: 'apps', label: 'Apps & creative tools', blurb: 'Commercial and classic software rebuilt from scratch, decompiled or recompiled.' },
  { id: 'os', label: 'OS & system', blurb: 'Operating systems, compatibility layers, firmware and system software, reimplemented.' },
  { id: 'tools', label: 'RE tooling', blurb: 'Decompilers, recompilers, lifters and matching tools that the whole scene runs on.' },
  { id: 'preservation', label: 'Preservation & revivals', blurb: 'Server revivals, protocol reimplementations, Flash and abandonware preservation.' },
];

export const METHOD_LABEL: Record<Method, string> = {
  'matching-decomp': 'Matching decomp', 'non-matching-decomp': 'Decompilation', 'static-recomp': 'Static recomp',
  'clean-room': 'Clean-room', rewrite: 'Rewrite', 'source-port': 'Source port', 'source-release': 'Official source release', lift: 'Binary lift',
  'emulation-hosted': 'Emulation-hosted', tool: 'Tool',
};
export const PROVENANCE_LABEL: Record<Provenance, string> = {
  'human-led': 'Human-led', 'ai-assisted': 'AI-assisted', 'ai-generated': 'AI-generated', unknown: 'Not stated',
};
export const TIER_LABEL: Record<Playable['tier'], string> = {
  cleanroom: 'Clean-room, ROM-free', free: 'Free original', byo: 'Bring your own file', software: 'Software in the browser',
};

let cache: Project[] | null = null;
export function projects(): Project[] {
  if (cache) return cache;
  const all = CATEGORIES.flatMap((c) => read<Project[]>(`projects/${c.id}.json`, []));
  cache = all.sort((a, b) => a.name.localeCompare(b.name));
  return cache;
}
export const bySlug = (slug: string) => projects().find((p) => p.slug === slug);

export function stats(): Record<string, Stats> { return read('stats/latest.json', { repos: {} } as { repos: Record<string, Stats> }).repos; }
export function statsDate(): string | null { return read<{ date?: string }>('stats/latest.json', {}).date ?? null; }
/** Daily snapshots (data/stats/YYYY-MM-DD.json), oldest first: star series and growth before 7 days exist. */
type Snap = Record<string, { stars: number }>;
let snapCache: { date: string; repos: Snap }[] | null = null;
export function snapshots() {
  if (snapCache) return snapCache;
  const dir = path.join(DATA, 'stats');
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort() : [];
  snapCache = files.map((f) => ({ date: f.slice(0, 10), repos: JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) as Snap }));
  return snapCache;
}
export const starSeries = (p: Project) => {
  if (!p.repo) return [];
  const k = repoKey(p.repo);
  return snapshots().filter((s) => s.repos[k]).map((s) => ({ date: s.date, stars: s.repos[k].stars }));
};
/** Star growth over the last 7 days, or over as many days of snapshots as exist so far. */
export function growth(p: Project): { delta: number; days: number } | null {
  const st = statsFor(p);
  if (st?.starsWeek != null && snapshots().length >= 8) return { delta: st.starsWeek, days: 7 };
  const s = starSeries(p);
  if (s.length < 2) return st?.starsWeek != null ? { delta: st.starsWeek, days: 7 } : null;
  const last = s[s.length - 1];
  const first = s.find((x) => Date.parse(last.date) - Date.parse(x.date) <= 7 * 864e5)!;
  const days = Math.round((Date.parse(last.date) - Date.parse(first.date)) / 864e5);
  return days >= 1 ? { delta: last.stars - first.stars, days } : null;
}
export const growthLabel = (g: { delta: number; days: number }) => `+${fmtNum(g.delta)} ★ ${g.days === 7 ? 'this week' : `in ${g.days} days`}`;

export const statsFor = (p: Project) => (p.repo ? stats()[repoKey(p.repo)] : undefined);
export function repoKey(url: string) {
  const m = url.match(/github\.com\/([^/]+\/[^/#?]+)/i);
  return m ? m[1].replace(/\.git$/, '').toLowerCase() : url;
}

/** Decomp progress from scripts/fetch-progress.mjs. Ranked = the project opted into public tracking (ByteMatch,
 * decomp.dev, frogress); only ranked projects go on movers boards, leaderboards and the milestones feed. */
export type ProgressSource = 'bytematch' | 'decompdev' | 'frogress' | 'site' | 'artifact' | 'badge' | 'manual';
export interface Progress {
  pct: number; codePct: number | null; fuzzyPct: number | null; linkedPct: number | null;
  matchedFns: number | null; totalFns: number | null; version: string | null;
  source: ProgressSource; sourceUrl: string | null; ranked: boolean; at: string;
}
export const PROGRESS_SOURCE_LABEL: Record<ProgressSource, string> = {
  bytematch: 'ByteMatch', decompdev: 'decomp.dev', frogress: 'progress.deco.mp', site: 'its own progress page', artifact: 'its own CI report',
  badge: 'its README badge', manual: 'the project',
};
type Point = [string, number, number | null];
let progCache: { date: string | null; repos: Record<string, Progress> } | null = null;
let progHist: Record<string, { source: string; points: Point[] }> | null = null;
const prog = () => (progCache ??= read('progress/latest.json', { date: null, repos: {} }));
export const progressDate = () => prog().date;
export function progressFor(p: Project): Progress | undefined {
  const r = p.repo ? prog().repos[repoKey(p.repo)] : undefined;
  if (r) return r;
  if (p.progress == null) return undefined;
  return { pct: p.progress, codePct: null, fuzzyPct: null, linkedPct: null, matchedFns: null, totalFns: null, version: null, source: 'manual', sourceUrl: p.progressSource, ranked: false, at: p.checked };
}
export const progressSeries = (p: Project): Point[] => (p.repo ? ((progHist ??= read('progress/history.json', {}))[repoKey(p.repo)]?.points ?? []) : []);
/** Percentage points gained over the last N days (needs a point at or before the cut-off). */
export function progressDelta(p: Project, days: number): number | null {
  const s = progressSeries(p);
  if (s.length < 2) return null;
  const cut = new Date(Date.parse(progressDate() ?? s[s.length - 1][0]) - days * 864e5).toISOString().slice(0, 10);
  const before = [...s].reverse().find((x) => x[0] <= cut);
  return before ? Math.round((s[s.length - 1][1] - before[1]) * 100) / 100 : null;
}
/** One project per repo: several catalogue entries can share a repo (and its progress). */
export const tracked = () => {
  const seen = new Set<string>();
  return projects().filter((p) => { const pr = progressFor(p); if (!pr) return false; const k = p.repo ? repoKey(p.repo) : p.slug; if (seen.has(k)) return false; seen.add(k); return true; });
};
export const movers = (days: number, n = 10) => tracked().filter((p) => progressFor(p)!.ranked)
  .map((p) => ({ p, delta: progressDelta(p, days) ?? 0 })).filter((x) => x.delta > 0).sort((a, b) => b.delta - a.delta).slice(0, n);
const MILESTONES = [10, 25, 50, 75, 90, 100];
export function milestones(n = 30) {
  const out: { p: Project; date: string; mark: number }[] = [];
  for (const p of tracked().filter((p) => progressFor(p)!.ranked)) {
    const s = progressSeries(p);
    for (let i = 1; i < s.length; i++) {
      const m = MILESTONES.filter((m) => s[i - 1][1] < m && s[i][1] >= m).pop(); // several crossed in one day = the highest
      if (m) out.push({ p, date: s[i][0], mark: m });
    }
  }
  return out.sort((a, b) => b.date.localeCompare(a.date) || b.mark - a.mark).slice(0, n);
}

/** Each project's own picture (social preview or README image), thumbnailed by scripts/fetch-media.mjs. */
export interface Media { src: string; kind: 'social' | 'readme'; thumb?: string }
let mediaCache: Record<string, Media> | null = null;
export const mediaFor = (p: Project) => (mediaCache ??= read<Record<string, Media>>('media.json', {}))[p.slug];

/** Stable hue per platform, for the generated cover of projects without a picture. */
export const platformHue = (platform: string) => [...platform].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);

export const history = () => read<HistoryEra[]>('history.json', []);
type Edge = { slug: string; parents: string[]; relation: string };
/** Curated edges (lineage.json) plus "built with" edges derived from what projects say (scripts/derive-lineage.mjs). */
export const lineage = () => [...read<Edge[]>('lineage.json', []), ...read<Edge[]>('lineage-derived.json', [])];
export const news = () => read<NewsItem[]>('news.json', []).sort((a, b) => b.date.localeCompare(a.date));

export const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export const platforms = () => {
  const m = new Map<string, Project[]>();
  for (const p of projects()) {
    if (!p.originalPlatform || p.category === 'tools') continue;
    const k = p.originalPlatform;
    m.set(k, [...(m.get(k) ?? []), p]);
  }
  return [...m.entries()].map(([name, list]) => ({ name, slug: slugify(name), list })).sort((a, b) => b.list.length - a.list.length);
};
/** Link to a platform page, or undefined when it has none (tools-only platforms such as Python or RISC-V get no page). */
let platformSlugs: Set<string> | null = null;
export const platformHref = (name: string) => {
  const slug = slugify(name);
  return (platformSlugs ??= new Set(platforms().map((p) => p.slug))).has(slug) ? `/platforms/${slug}/` : undefined;
};

/** The short name people search with ("N64 recomp", "PS2 decomp"). */
export const PLATFORM_SHORT: Record<string, string> = {
  'Nintendo 64': 'N64', PlayStation: 'PS1', 'PlayStation 2': 'PS2', 'PlayStation 3': 'PS3', 'PlayStation 4': 'PS4',
  'PlayStation Portable': 'PSP', 'Game Boy Advance': 'GBA', 'Game Boy Color': 'GBC', 'Nintendo DS': 'DS', 'Nintendo 3DS': '3DS',
  'Nintendo Switch': 'Switch', 'MS-DOS': 'DOS',
};
export const shortName = (platform: string) => PLATFORM_SHORT[platform] ?? platform;

/** One page per original game with 2+ projects (decomp + recomp + ports of the same title). */
export const gameKey = (subject: string) => slugify(subject.replace(/\s*\([^)]*\)/g, '').replace(/[’']/g, ''));
let hubCache: { slug: string; name: string; list: Project[]; platform: string; year: number | null }[] | null = null;
export const gameHubs = () => {
  if (hubCache) return hubCache;
  const m = new Map<string, Project[]>();
  for (const p of projects()) if (p.category === 'games') { const k = gameKey(p.subject); if (k) m.set(k, [...(m.get(k) ?? []), p]); }
  hubCache = [...m.entries()].filter(([, list]) => list.length >= 2).map(([slug, list]) => {
    const names = list.map((p) => p.subject.replace(/\s*\([^)]*\)/g, '').trim());
    const count = (n: string) => names.filter((x) => x === n).length;
    const name = [...names].sort((a, b) => count(b) - count(a) || a.length - b.length)[0];
    return { slug, name, list, platform: list[0].originalPlatform, year: list.find((p) => p.originalYear)?.originalYear ?? null };
  }).sort((a, b) => b.list.length - a.list.length || a.name.localeCompare(b.name));
  return hubCache;
};
export const hubFor = (p: Project) => (p.category === 'games' ? gameHubs().find((h) => h.slug === gameKey(p.subject)) : undefined);

/** "Heat": star velocity + recent release + commits, for the trend board. */
export function heat(p: Project): number {
  const s = statsFor(p);
  if (!s) return 0;
  const rel = s.release?.date ?? p.latestRelease?.date;
  const daysSinceRelease = rel ? (Date.now() - Date.parse(rel)) / 864e5 : 999;
  const g = growth(p);
  const week = g ? (g.delta * 7) / g.days : 0;
  return week * 3 + (s.starsMonth ?? 0) * 0.5 + Math.min(s.commits30 ?? 0, 200) * 0.5 + (daysSinceRelease < 14 ? 150 : daysSinceRelease < 45 ? 40 : 0);
}

export function formatDate(d: string) {
  if (/^\d{4}s$/.test(d) || /^\d{4}$/.test(d)) return d;
  const [y, m, day] = d.split('-').map(Number);
  const mon = new Date(Date.UTC(y, (m ?? 1) - 1, day ?? 1)).toLocaleString('en', { month: 'short', timeZone: 'UTC' });
  return day ? `${mon} ${day}, ${y}` : `${mon} ${y}`;
}
export const fmtNum = (n: number) => (n >= 10000 ? `${Math.round(n / 1000)}k` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));
