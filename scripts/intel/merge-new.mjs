// Merge agent-written entries (.cache/new/batch-*.json) into data/projects/<category>.json.
// Skips repos already tracked, de-duplicates slugs, appends after the curated entries. Run validate.mjs afterwards.
// Usage: node scripts/intel/merge-new.mjs [--dry]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const P = path.join(ROOT, 'data/projects');
const NEW = path.join(ROOT, '.cache/new');
const CATS = ['games', 'apps', 'os', 'tools', 'preservation'];
const norm = (u) => (u ?? '').toLowerCase().replace(/\.git$/, '').replace(/\/$/, '');
const files = Object.fromEntries(CATS.map((c) => [c, JSON.parse(fs.readFileSync(path.join(P, `${c}.json`), 'utf8'))]));
const slugs = new Set(CATS.flatMap((c) => files[c].map((p) => p.slug)));
const repos = new Set(CATS.flatMap((c) => files[c].map((p) => norm(p.repo))).filter(Boolean));

let added = 0, dup = 0, bad = 0;
const perCat = {};
for (const f of fs.readdirSync(NEW).filter((f) => /^batch-\d+[a-z]?\.json$/.test(f)).sort()) {
  let list;
  try { list = JSON.parse(fs.readFileSync(path.join(NEW, f), 'utf8')); } catch (e) { console.log(`! ${f}: ${e.message}`); continue; }
  for (const p of list) {
    if (!CATS.includes(p.category)) { bad++; console.log(`! ${f} ${p.slug}: category ${p.category}`); continue; }
    if (p.repo && repos.has(norm(p.repo))) { dup++; continue; }
    let s = p.slug, n = 2;
    while (slugs.has(s)) s = `${p.slug}-${n++}`;
    p.slug = s; slugs.add(s); if (p.repo) repos.add(norm(p.repo));
    files[p.category].push(p); added++; perCat[p.category] = (perCat[p.category] ?? 0) + 1;
  }
}
if (!process.argv.includes('--dry'))
  for (const c of CATS) fs.writeFileSync(path.join(P, `${c}.json`), JSON.stringify(files[c], null, 2) + '\n');
console.log(`merge: +${added} (${JSON.stringify(perCat)}), ${dup} already tracked, ${bad} bad; total now ${CATS.reduce((a, c) => a + files[c].length, 0)}`);
