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
export const statsFor = (p: Project) => (p.repo ? stats()[repoKey(p.repo)] : undefined);
export function repoKey(url: string) {
  const m = url.match(/github\.com\/([^/]+\/[^/#?]+)/i);
  return m ? m[1].replace(/\.git$/, '').toLowerCase() : url;
}

export const history = () => read<HistoryEra[]>('history.json', []);
export const lineage = () => read<{ slug: string; parents: string[]; relation: string }[]>('lineage.json', []);
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
  return (s.starsWeek ?? 0) * 3 + (s.starsMonth ?? 0) * 0.5 + Math.min(s.commits30 ?? 0, 200) * 0.5 + (daysSinceRelease < 14 ? 150 : daysSinceRelease < 45 ? 40 : 0);
}

export function formatDate(d: string) {
  if (/^\d{4}s$/.test(d) || /^\d{4}$/.test(d)) return d;
  const [y, m, day] = d.split('-').map(Number);
  const mon = new Date(Date.UTC(y, (m ?? 1) - 1, day ?? 1)).toLocaleString('en', { month: 'short', timeZone: 'UTC' });
  return day ? `${mon} ${day}, ${y}` : `${mon} ${y}`;
}
export const fmtNum = (n: number) => (n >= 10000 ? `${Math.round(n / 1000)}k` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));
