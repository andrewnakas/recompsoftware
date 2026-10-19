// Workers Builds entry (build command `npm run cf-build` in apps/web). Replaces the old GitHub Actions job:
// pull generated data from R2 -> daily stats snapshot if today's is missing -> Monday picture refresh -> validate + astro build
// -> push what changed back to R2 -> flag the deploy step to ping IndexNow once a day.
// GITHUB_TOKEN (build secret, public read-only) is needed for the snapshot and pictures; without it the build uses the data it has.
// Locally: `npm run cf-build` does the same with wrangler's login (set GITHUB_TOKEN or have `gh` logged in).
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { ROOT, pull, push, stamp } from './data.mjs';

const today = new Date().toISOString().slice(0, 10);
const sh = (cmd, cwd = ROOT) => execSync(cmd, { cwd, stdio: 'inherit' });
const hasToken = !!process.env.GITHUB_TOKEN || (() => { try { execSync('gh auth token', { stdio: 'ignore' }); return true; } catch { return false; } })();
const FLAG = path.join(ROOT, '.cache/indexnow-due');
fs.rmSync(FLAG, { force: true });

if (!fs.existsSync(path.join(ROOT, 'apps/web/node_modules/astro'))) sh('npm ci', path.join(ROOT, 'apps/web'));
pull(['stats', 'media']);

const changed = [];
if (!fs.existsSync(path.join(ROOT, 'data/stats', `${today}.json`))) {
  if (hasToken) { sh('node scripts/fetch-stats.mjs'); changed.push('stats'); }
  else console.log('stats: no GITHUB_TOKEN, snapshot skipped');
}
// Pictures (~6 min) never share a build with the snapshot (~4 min), keeping each build well under the time limit.
if (new Date().getUTCDay() === 1 && hasToken && !changed.length && stamp('media-stamp.txt') !== today) {
  sh('node scripts/fetch-media.mjs');
  changed.push('media');
}

sh('npm run build', path.join(ROOT, 'apps/web'));

if (changed.length) {
  push(changed);
  if (changed.includes('media')) stamp('media-stamp.txt', today);
}
if (changed.includes('stats')) fs.writeFileSync(FLAG, today);
console.log(`cf-build: ${today}, pushed [${changed.join(', ')}]`);
