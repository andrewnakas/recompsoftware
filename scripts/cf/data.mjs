// Generated data lives in R2 (bucket recompsoftware-data), not in git: daily stats snapshots and project pictures.
// Objects: stats.tgz = data/stats/*.json + data/progress/ · media.tgz = data/media.json + apps/web/public/thumbs/ · media-stamp.txt = date of the last picture refresh.
// The git copies are the fallback baseline: pull unpacks R2 over them, so a build without R2 access still works on older data.
// Auth: CLOUDFLARE_API_TOKEN in Workers Builds, else wrangler's login. Usage: node scripts/cf/data.mjs pull|push [stats] [media]
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const BUCKET = 'recompsoftware-data';
const TMP = path.join(ROOT, '.cache/r2');
const SETS = {
  stats: ['data/stats', 'data/progress'],
  media: ['data/media.json', 'apps/web/public/thumbs'],
};

const run = (cmd, args) => execFileSync(cmd, args, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], shell: process.platform === 'win32' }).toString();
const wrangler = (...args) => run('npx', ['-y', 'wrangler@4', 'r2', 'object', ...args, '--remote']);

export function get(key, file) {
  try { wrangler('get', `${BUCKET}/${key}`, '--file', file); return fs.existsSync(file) && fs.statSync(file).size > 0; }
  catch { return false; }
}
export function put(key, file) { wrangler('put', `${BUCKET}/${key}`, '--file', file); }

// Git may be ahead of R2 (entries and thumbs added by hand, a snapshot committed locally), so pull merges instead of
// overwriting: media.json keeps git-only keys, latest.json keeps whichever side has the newer date. Untarring never deletes files.
const readJson = (f) => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8')); } catch { return null; } };
const MERGE = {
  'data/media.json': (git, r2) => ({ ...git, ...r2 }),
  'data/stats/latest.json': (git, r2) => (git && r2 && git.date > r2.date ? git : r2),
  'data/progress/latest.json': (git, r2) => (git && r2 && git.date > r2.date ? git : r2),
};

export function pull(sets) {
  fs.mkdirSync(TMP, { recursive: true });
  for (const s of sets) {
    const tgz = path.join(TMP, `${s}.tgz`);
    if (!get(`${s}.tgz`, tgz)) { console.log(`r2 pull ${s}: none, using git copy`); continue; }
    const merges = Object.keys(MERGE).filter((f) => SETS[s].some((p) => f.startsWith(p)));
    const git = Object.fromEntries(merges.map((f) => [f, readJson(f)]));
    run('tar', ['-xzf', path.relative(ROOT, tgz).replaceAll('\\', '/')]);
    for (const f of merges) {
      const r2 = readJson(f);
      if (git[f] && r2) fs.writeFileSync(path.join(ROOT, f), JSON.stringify(MERGE[f](git[f], r2)));
    }
    console.log(`r2 pull ${s}: ${(fs.statSync(tgz).size / 1e6).toFixed(1)} MB`);
  }
}

export function push(sets) {
  fs.mkdirSync(TMP, { recursive: true });
  for (const s of sets) {
    const tgz = path.join(TMP, `${s}.tgz`);
    run('tar', ['-czf', path.relative(ROOT, tgz).replaceAll('\\', '/'), ...SETS[s]]);
    put(`${s}.tgz`, tgz);
    console.log(`r2 push ${s}: ${(fs.statSync(tgz).size / 1e6).toFixed(1)} MB`);
  }
}

export function stamp(key, value) {
  const f = path.join(TMP, key);
  fs.mkdirSync(TMP, { recursive: true });
  if (value === undefined) return get(key, f) ? fs.readFileSync(f, 'utf8').trim() : null;
  fs.writeFileSync(f, value);
  put(key, f);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [cmd, ...rest] = process.argv.slice(2);
  const sets = rest.length ? rest : Object.keys(SETS);
  if (cmd === 'pull') pull(sets);
  else if (cmd === 'push') push(sets);
  else { console.error('usage: node scripts/cf/data.mjs pull|push [stats] [media]'); process.exit(1); }
}
