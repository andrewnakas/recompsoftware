// Merge write-ups (.cache/seo/about-*.json: { slug: { about, aboutChecked } }) into data/projects/<category>.json.
// Usage: node scripts/intel/merge-about.mjs [--dry]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const P = path.join(ROOT, 'data/projects');
const SRC = path.join(ROOT, '.cache/seo');
const CATS = ['games', 'apps', 'os', 'tools', 'preservation'];
const files = Object.fromEntries(CATS.map((c) => [c, JSON.parse(fs.readFileSync(path.join(P, `${c}.json`), 'utf8'))]));
const bySlug = new Map(CATS.flatMap((c) => files[c].map((p) => [p.slug, p])));
let n = 0, miss = [];
for (const f of fs.readdirSync(SRC).filter((f) => /^about-\d+\.json$/.test(f)).sort()) {
  for (const [slug, v] of Object.entries(JSON.parse(fs.readFileSync(path.join(SRC, f), 'utf8')))) {
    const p = bySlug.get(slug);
    if (!p || !v?.about) { miss.push(slug); continue; }
    p.about = v.about.trim(); p.aboutChecked = v.aboutChecked ?? new Date().toISOString().slice(0, 10); n++;
  }
}
if (!process.argv.includes('--dry'))
  for (const c of CATS) fs.writeFileSync(path.join(P, `${c}.json`), JSON.stringify(files[c], null, 2) + '\n');
console.log(`merge-about: ${n} write-ups${miss.length ? `, skipped ${miss.join(', ')}` : ''}`);
