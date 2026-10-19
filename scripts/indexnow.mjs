// Ping IndexNow (Bing, Yandex, Seznam…) with every URL in the built sitemap. Usage: node scripts/indexnow.mjs [--if-due]
// --if-due (Workers Builds deploy step): ping only when scripts/cf/build.mjs took today's stats snapshot, so once a day.
import fs from 'node:fs';
const KEY = '0b91c87ee571133329637237ec2b8697';
const FLAG = new URL('../.cache/indexnow-due', import.meta.url);
if (process.argv.includes('--if-due') && !fs.existsSync(FLAG)) { console.log('indexnow: not due'); process.exit(0); }
const xml = fs.readFileSync(new URL('../apps/web/dist/sitemap.xml', import.meta.url), 'utf8');
const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
try {
  const r = await fetch('https://www.bing.com/indexnow', {
    method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ host: 'recompsoftware.com', key: KEY, keyLocation: `https://recompsoftware.com/${KEY}.txt`, urlList: urls.slice(0, 10000) }),
  });
  console.log(`indexnow: ${urls.length} urls -> HTTP ${r.status}`);
} catch (e) { console.log(`indexnow: failed (${e.message})`); }
fs.rmSync(FLAG, { force: true });
