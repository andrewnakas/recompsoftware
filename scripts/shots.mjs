// Silent headless screenshots of the built site + one contact sheet. Serves apps/web/dist itself.
// Usage: node scripts/shots.mjs [outDir]   (needs @playwright/test; uses the copy in D:\n64work\site-wt if not installed here)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'apps/web/dist');
const out = path.resolve(process.argv[2] || path.join(ROOT, '.cache/shots'));
fs.mkdirSync(out, { recursive: true });
let req;
try { req = createRequire(path.join(ROOT, 'package.json')); req.resolve('@playwright/test'); } catch { req = createRequire('D:/n64work/site-wt/package.json'); }
const { chromium } = req('@playwright/test');

const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.xml': 'application/xml', '.txt': 'text/plain', '.png': 'image/png' };
const server = http.createServer((q, r) => {
  let f = path.join(DIST, decodeURIComponent(q.url.split('?')[0]));
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  if (!fs.existsSync(f)) { r.writeHead(404); r.end(fs.readFileSync(path.join(DIST, '404.html'))); return; }
  r.writeHead(200, { 'Content-Type': types[path.extname(f)] ?? 'application/octet-stream' }); r.end(fs.readFileSync(f));
}).listen(4377);
const base = 'http://127.0.0.1:4377';

const pages = (process.env.PAGES || '/,/games/,/p/zelda64recomp/,/p/vectorcraft/,/trending/,/play/,/history/,/recompiled-games-list/').split(',');
const browser = await chromium.launch({ channel: 'msedge', args: ['--mute-audio'] });
const shots = [];
for (const [label, width, height] of [['desktop', 1280, 900], ['phone', 390, 844]]) {
  const ctx = await browser.newContext({ viewport: { width, height }, colorScheme: 'dark' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  for (const p of pages) {
    await page.goto(base + p, { waitUntil: 'networkidle' }).catch(() => {});
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
    const f = path.join(out, `${label}-${p.replace(/\W+/g, '_') || 'home'}.png`);
    await page.screenshot({ path: f });
    shots.push({ f, label: `${label} ${p}${overflow ? ' OVERFLOW' : ''}` });
  }
  // Catalogue behaviour.
  await page.goto(base + '/projects/');
  await page.fill('input[type=search]', 'zelda');
  await page.waitForTimeout(200);
  const zelda = await page.locator('.pc:not([hidden])').count();
  console.log(`${label}: search zelda=${zelda} errors=${errors.length ? errors.join(' | ') : 'none'}`);
  await ctx.close();
}
// Contact sheet: one page of thumbnails.
const sheet = await browser.newPage({ viewport: { width: 1600, height: 1200 } });
const html = `<body style="margin:0;background:#222;color:#eee;font:12px sans-serif;display:grid;grid-template-columns:repeat(4,1fr);gap:6px;padding:6px">${shots.map((s) => `<figure style="margin:0"><img style="width:100%;display:block" src="data:image/png;base64,${fs.readFileSync(s.f).toString('base64')}"><figcaption>${s.label}</figcaption></figure>`).join('')}</body>`;
await sheet.setContent(html);
await sheet.screenshot({ path: path.join(out, 'sheet.png'), fullPage: true });
await browser.close();
server.close();
console.log(`sheet: ${path.join(out, 'sheet.png')} (${shots.length} shots; overflow on: ${shots.filter((s) => s.label.includes('OVERFLOW')).map((s) => s.label).join(', ') || 'none'})`);
