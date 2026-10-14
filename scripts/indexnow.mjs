// Ping IndexNow (Bing, Yandex, Seznam…) with every URL in the built sitemap. Usage: node scripts/indexnow.mjs
import fs from 'node:fs';
const KEY = '0b91c87ee571133329637237ec2b8697';
const xml = fs.readFileSync(new URL('../apps/web/dist/sitemap.xml', import.meta.url), 'utf8');
const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
const r = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ host: 'recompsoftware.com', key: KEY, keyLocation: `https://recompsoftware.com/${KEY}.txt`, urlList: urls.slice(0, 10000) }),
});
console.log(`indexnow: ${urls.length} urls -> HTTP ${r.status}`);
