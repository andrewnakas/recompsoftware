// Catalogue growth: harvest candidate repos (GitHub searches + curated scene lists) -> .cache/harvest.json.
// Candidates are leads only; each one is checked and written up by hand (or by an agent) before it enters data/projects.
// Usage: node scripts/intel/harvest.mjs [--min-stars 25]
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const DATA = path.join(ROOT, 'data');
const minStars = Number(process.argv[process.argv.indexOf('--min-stars') + 1]) || 25;
const token = process.env.GITHUB_TOKEN || execSync('gh auth token').toString().trim();
const H = { 'User-Agent': 'recompsoftware-harvest/0.1', Authorization: `bearer ${token}`, Accept: 'application/vnd.github+json' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const norm = (u) => u.toLowerCase().replace(/\.git$/, '').replace(/\/$/, '');

const known = new Set();
for (const f of fs.readdirSync(path.join(DATA, 'projects')).filter((f) => f.endsWith('.json')))
  for (const p of JSON.parse(fs.readFileSync(path.join(DATA, 'projects', f), 'utf8'))) if (p.repo) known.add(norm(p.repo));

const SEARCHES = [
  'topic:decompilation', 'topic:decomp', 'topic:decompiled', 'topic:matching-decompilation', 'topic:recompilation',
  'topic:static-recompilation', 'topic:n64recomp', 'topic:recomp', 'topic:source-port', 'topic:game-reimplementation',
  'topic:reimplementation', 'topic:clean-room', 'topic:open-source-reimplementation', 'topic:engine-reimplementation',
  'topic:game-engine-recreation', 'topic:abandonware', 'topic:server-emulator', 'topic:private-server', 'topic:revival',
  'topic:game-preservation', 'topic:preservation', 'topic:reverse-engineering topic:game', 'topic:reverse-engineering topic:games',
  'topic:binary-lifting', 'topic:decompiler', 'topic:disassembler', 'topic:ghidra', 'topic:ida-pro', 'topic:binary-translation',
  'topic:emulator topic:wasm', 'topic:webassembly topic:emulator', 'topic:dos topic:source-port', 'topic:pc-port',
  'topic:n64 topic:decomp', 'topic:ps1 topic:decomp', 'topic:ps2 topic:decomp', 'topic:gamecube topic:decomp', 'topic:gba topic:decomp',
  'topic:nds topic:decomp', 'topic:xbox topic:decomp', 'topic:snes topic:disassembly', 'topic:nes topic:disassembly', 'topic:disassembly',
  'topic:wii topic:decomp', 'topic:dreamcast', 'topic:saturn topic:reverse-engineering', 'topic:flash topic:preservation',
  '"decompilation of" in:description', '"decompilation project" in:description', '"matching decompilation" in:description',
  '"decomp of" in:description', '"recompilation of" in:description', '"static recompilation" in:description', '"recompiled" port in:description',
  '"reimplementation of" in:description', '"open source reimplementation" in:description', '"open-source reimplementation" in:description',
  '"open source re-implementation" in:description', '"clean-room" in:description', '"clean room reimplementation" in:description',
  '"reverse engineered" engine in:description', '"reverse-engineered" game in:description', '"source port" in:description',
  '"engine recreation" in:description', '"remake of the engine" in:description', '"disassembly of" in:description',
  '"server emulator" in:description', '"revival" server game in:description', '"PC port" decomp in:description',
  '"native port" in:description', '"rewrite of" classic in:description', '"open source remake" in:description',
];
// Curated scene lists (their links are the strongest leads); README parsed for github.com/owner/repo.
const LISTS = [
  'radek-k/Awesome-Game-Remakes', 'CharlotteCross1998/awesome-game-decompilations', 'bobeff/open-source-games',
  'leomaurodesenv/game-datasets', 'Brett208/awesome-game-reverse-engineering', 'NotNite/awesome-decomps',
  'samuelmtimbo/awesome-reimplementations', 'zaher-sh/awesome-reimplementations', 'retrogamecorps/decomps',
  'fwcd/awesome-re-implementations', 'yearofthegame/awesome-reversing', 'tylerjbrooks/awesome-game-preservation',
  'pirate/awesome-game-decomps', 'ckosmic/awesome-decomps', 'mikeroyal/Open-Source-Game-Reimplementations',
];

const cands = new Map();
const put = (it, via) => {
  const url = norm(it.html_url);
  if (known.has(url) || it.fork || it.stargazers_count < minStars || /^awesome/i.test(it.name)) return;
  const c = cands.get(url) ?? { repo: it.html_url, name: it.full_name, desc: it.description ?? '', stars: it.stargazers_count,
    licence: it.license?.spdx_id ?? 'none', created: it.created_at?.slice(0, 10), pushed: it.pushed_at?.slice(0, 10),
    archived: it.archived, topics: it.topics ?? [], homepage: it.homepage || null, lang: it.language, via: [] };
  c.via.push(via);
  cands.set(url, c);
};

let n = 0;
for (const q of SEARCHES) {
  for (const page of [1, 2, 3]) {
    const r = await fetch(`https://api.github.com/search/repositories?q=${encodeURIComponent(`${q} stars:>=${minStars}`)}&sort=stars&order=desc&per_page=100&page=${page}`, { headers: H });
    const j = await r.json();
    if (!r.ok) { console.log(`! ${q}: ${j.message}`); await sleep(30000); break; }
    for (const it of j.items ?? []) put(it, `search:${q}`);
    n++;
    await sleep(2200);
    if ((j.items ?? []).length < 100) break;
  }
}

const listRepos = new Set();
for (const l of LISTS) {
  const r = await fetch(`https://api.github.com/repos/${l}/readme`, { headers: { ...H, Accept: 'application/vnd.github.raw' } });
  if (!r.ok) { console.log(`- list ${l}: ${r.status}`); continue; }
  const md = await r.text();
  const found = [...md.matchAll(/github\.com\/([\w.-]+)\/([\w.-]+)/g)].map((m) => `${m[1]}/${m[2].replace(/\.git$/, '')}`);
  for (const f of found) if (!/^(sponsors|topics|orgs|features|about|marketplace|apps)$/i.test(f.split('/')[0])) listRepos.add(`${f}|${l}`);
  console.log(`+ list ${l}: ${found.length} links`);
}
// Look up list links not already found by search (GraphQL, 50 per call).
const pending = [...listRepos].map((s) => s.split('|')).filter(([f]) => !cands.has(norm(`https://github.com/${f}`)) && !known.has(norm(`https://github.com/${f}`)));
for (let i = 0; i < pending.length; i += 50) {
  const chunk = pending.slice(i, i + 50);
  const q = `{${chunk.map(([f], k) => { const [o, nm] = f.split('/'); return `r${k}: repository(owner: ${JSON.stringify(o)}, name: ${JSON.stringify(nm)}) { url name nameWithOwner description stargazerCount isFork isArchived createdAt pushedAt homepageUrl licenseInfo { spdxId } primaryLanguage { name } repositoryTopics(first: 10) { nodes { topic { name } } } }`; }).join(' ')}}`;
  const r = await fetch('https://api.github.com/graphql', { method: 'POST', headers: H, body: JSON.stringify({ query: q }) });
  const j = await r.json();
  chunk.forEach(([f, l], k) => {
    const x = j.data?.[`r${k}`];
    if (!x) return;
    put({ html_url: x.url, name: x.name, full_name: x.nameWithOwner, description: x.description, stargazers_count: x.stargazerCount, fork: x.isFork,
      archived: x.isArchived, created_at: x.createdAt, pushed_at: x.pushedAt, homepage: x.homepageUrl, license: x.licenseInfo ? { spdx_id: x.licenseInfo.spdxId } : null,
      language: x.primaryLanguage?.name, topics: x.repositoryTopics.nodes.map((t) => t.topic.name) }, `list:${l}`);
  });
  await sleep(1000);
}

const out = [...cands.values()].sort((a, b) => b.via.length - a.via.length || b.stars - a.stars);
fs.mkdirSync(path.join(ROOT, '.cache'), { recursive: true });
fs.writeFileSync(path.join(ROOT, '.cache/harvest.json'), JSON.stringify(out, null, 1));
console.log(`${n} searches, ${listRepos.size} list links -> ${out.length} new candidates (>= ${minStars} stars, not already tracked) in .cache/harvest.json`);
