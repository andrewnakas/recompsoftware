// Schema checks for data/projects/*.json, history.json, lineage.json. Exit 1 on any error.
// Usage: node scripts/validate.mjs [--quiet]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DATA = process.env.RECOMP_DATA ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../data');
const CATS = ['games', 'apps', 'os', 'tools', 'preservation'];
const METHODS = ['matching-decomp', 'non-matching-decomp', 'static-recomp', 'clean-room', 'rewrite', 'source-port', 'lift', 'emulation-hosted', 'tool'];
const PROV = ['human-led', 'ai-assisted', 'ai-generated', 'unknown'];
const STATUS = ['released', 'complete', 'wip', 'stalled', 'archived'];
const TIERS = ['cleanroom', 'free', 'byo', 'software'];
const errors = [];
const warn = [];
const err = (where, msg) => errors.push(`${where}: ${msg}`);
const isUrl = (u) => typeof u === 'string' && /^https?:\/\/[^\s]+$/.test(u);
const read = (f) => { try { return JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8')); } catch (e) { if (fs.existsSync(path.join(DATA, f))) err(f, `bad JSON: ${e.message}`); return null; } };

const slugs = new Set();
const repos = new Map();
let total = 0;
for (const cat of CATS) {
  const list = read(`projects/${cat}.json`);
  if (!list) { warn.push(`projects/${cat}.json missing`); continue; }
  for (const p of list) {
    total++;
    const w = `${cat}/${p.slug ?? '?'}`;
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(p.slug ?? '')) err(w, 'slug must be kebab-case');
    if (slugs.has(p.slug)) err(w, 'duplicate slug'); slugs.add(p.slug);
    if (p.category !== cat) err(w, `category "${p.category}" in ${cat}.json`);
    for (const k of ['name', 'subject', 'summary', 'licence', 'checked']) if (!p[k] || typeof p[k] !== 'string') err(w, `missing ${k}`);
    if (!METHODS.includes(p.method)) err(w, `method "${p.method}"`);
    if (!PROV.includes(p.provenance)) err(w, `provenance "${p.provenance}"`);
    if (p.provenance !== 'unknown' && p.provenance !== 'human-led' && !p.provenanceNote) err(w, 'AI provenance needs provenanceNote');
    if (!STATUS.includes(p.status)) err(w, `status "${p.status}"`);
    if (p.progress != null && (typeof p.progress !== 'number' || p.progress < 0 || p.progress > 100)) err(w, 'progress 0-100');
    if (p.repo != null && !isUrl(p.repo)) err(w, 'repo not a URL');
    if (!p.repo && !p.website) err(w, 'needs repo or website');
    for (const k of ['website', 'discord', 'subreddit', 'progressSource']) if (p[k] != null && !isUrl(p[k])) err(w, `${k} not a URL`);
    if (!Array.isArray(p.sources) || p.sources.length === 0 || !p.sources.every(isUrl)) err(w, 'sources: at least one URL');
    for (const k of ['team', 'targets', 'tags']) if (!Array.isArray(p[k])) err(w, `${k} must be an array`);
    if (typeof p.needsOriginal !== 'boolean') err(w, 'needsOriginal boolean');
    if (p.playable) {
      if (!TIERS.includes(p.playable.tier)) err(w, `playable.tier "${p.playable.tier}"`);
      if (!isUrl(p.playable.url)) err(w, 'playable.url');
      if (!['frame', 'tab'].includes(p.playable.launch)) err(w, 'playable.launch');
      if (!p.playable.note) err(w, 'playable.note must say why it may be hosted');
    }
    if (p.summary && p.summary.length > 400) warn.push(`${w}: summary over 400 chars`);
    if (/\.(z64|n64|v64|iso|xiso|wbfs|rvz|nds|gba|sfc|smc)\b/i.test(JSON.stringify(p))) err(w, 'mentions a ROM/disc file: never link game data');
    if (p.repo) { const k = p.repo.toLowerCase(); if (repos.has(k)) warn.push(`${w}: same repo as ${repos.get(k)}`); repos.set(k, w); }
  }
}

const hist = read('history.json') ?? [];
for (const era of hist) for (const e of era.events ?? []) {
  const w = `history/${era.id}/${e.date}`;
  if (!/^\d{4}(s|-\d{2}(-\d{2})?)?$/.test(e.date ?? '')) err(w, 'date format');
  if (!isUrl(e.source)) err(w, 'source URL');
  if (!e.title || !e.body) err(w, 'title/body');
  for (const s of e.projects ?? []) if (!slugs.has(s)) warn.push(`${w}: unknown project ${s}`);
}
for (const e of read('lineage.json') ?? []) for (const s of [e.slug, ...(e.parents ?? [])]) if (!slugs.has(s)) warn.push(`lineage: unknown project ${s}`);

const quiet = process.argv.includes('--quiet');
console.log(`validate: ${total} projects, ${hist.reduce((a, e) => a + (e.events?.length ?? 0), 0)} history events, ${errors.length} errors, ${warn.length} warnings`);
for (const e of errors.slice(0, 40)) console.log('  ERR ', e);
if (!quiet) for (const e of warn.slice(0, 25)) console.log('  warn', e);
if (errors.length > 40) console.log(`  … ${errors.length - 40} more errors`);
process.exit(errors.length ? 1 : 0);
