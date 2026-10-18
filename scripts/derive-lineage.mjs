// "Built with" edges derived from what projects say about themselves: a project whose summary, tags or README head
// names one of these toolchains gets a `built-with` edge -> data/lineage-derived.json. Curated data/lineage.json wins.
// Usage: node scripts/derive-lineage.mjs   (README heads come from .cache/harvest*-enriched.json when present)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = path.join(ROOT, 'data');
const ALIASES = {
  n64recomp: 'N64Recomp', n64modernruntime: 'N64ModernRuntime|N64 ModernRuntime|ultramodern', rt64: 'RT64',
  xenonrecomp: 'XenonRecomp', xenosrecomp: 'XenosRecomp', ps2recomp: 'PS2Recomp', ps3recomp: 'ps3recomp', rexglue: 'ReXGlue|rexglue-sdk',
  splat: 'splat', libultraship: 'libultraship', torch: 'Torch', 'decomp-permuter': 'decomp-permuter|permuter', objdiff: 'objdiff',
  'asm-differ': 'asm-differ', 'ido-static-recomp': 'ido-static-recomp', 'decomp-toolkit': 'decomp-toolkit|dtk', spimdisasm: 'spimdisasm',
  m2c: 'm2c|mips_to_c', ghidra: 'Ghidra', 'decomp-me': 'decomp\.me', 'unleashed-recompiled': 'Unleashed Recompiled',
};
// Analysis and matching tools a project works with, as opposed to recompilers/runtimes it is built on.
const USES = new Set(['ghidra', 'decomp-me', 'objdiff', 'splat', 'decomp-permuter', 'asm-differ', 'm2c', 'spimdisasm', 'decomp-toolkit']);
const all = fs.readdirSync(path.join(DATA, 'projects')).filter((f) => f.endsWith('.json')).flatMap((f) => JSON.parse(fs.readFileSync(path.join(DATA, 'projects', f), 'utf8')));
const slugs = new Set(all.map((p) => p.slug));
const readme = {};
for (const f of fs.existsSync(path.join(ROOT, '.cache')) ? fs.readdirSync(path.join(ROOT, '.cache')).filter((f) => /^harvest.*enriched\.json$/.test(f)) : [])
  for (const c of JSON.parse(fs.readFileSync(path.join(ROOT, '.cache', f), 'utf8'))) readme[c.repo.toLowerCase()] = c.readme ?? '';
const prev = fs.existsSync(path.join(DATA, 'lineage-derived.json')) ? JSON.parse(fs.readFileSync(path.join(DATA, 'lineage-derived.json'), 'utf8')) : [];
const curated = new Set(JSON.parse(fs.readFileSync(path.join(DATA, 'lineage.json'), 'utf8')).flatMap((e) => e.parents.map((x) => `${e.slug}>${x}`)));

const edges = new Map();
for (const [tool, alias] of Object.entries(ALIASES)) {
  if (!slugs.has(tool)) continue;
  const re = new RegExp(`(^|[^\w-])(${alias})(?![\w-])`, alias === 'Torch' ? '' : 'i');
  for (const p of all) {
    if (p.slug === tool || curated.has(`${p.slug}>${tool}`)) continue;
    // Tools that merely compare themselves to Ghidra are not built with it.
    if ((tool === 'ghidra' || tool === 'unleashed-recompiled') && p.category === 'tools') continue;
    const text = `${p.summary} ${p.tags.join(' ')} ${readme[(p.repo ?? '').toLowerCase()] ?? ''}`;
    if (re.test(text)) edges.set(`${p.slug}>${tool}`, { slug: p.slug, parents: [tool], relation: USES.has(tool) ? 'uses' : 'built-with' });
  }
}
// README heads only exist on the machine that harvested; keep earlier edges for projects not re-read here.
for (const e of prev) { const k = `${e.slug}>${e.parents[0]}`; if (!edges.has(k) && slugs.has(e.slug) && !readme[(all.find((p) => p.slug === e.slug)?.repo ?? '').toLowerCase()]) edges.set(k, e); }
const out = [...edges.values()].sort((a, b) => a.parents[0].localeCompare(b.parents[0]) || a.slug.localeCompare(b.slug));
fs.writeFileSync(path.join(DATA, 'lineage-derived.json'), JSON.stringify(out, null, 1) + '\n');
const by = {}; for (const e of out) by[e.parents[0]] = (by[e.parents[0]] ?? 0) + 1;
console.log(`derive-lineage: ${out.length} edges; ${Object.entries(by).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ')}`);
