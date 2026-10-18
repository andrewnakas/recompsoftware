// Social cards (1200x630 JPEG): default + one per project -> apps/web/public/og/. Usage: node scripts/og.mjs [--only default]
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'apps/web/public/og');
fs.mkdirSync(OUT, { recursive: true });
let req;
try { req = createRequire(path.join(ROOT, 'package.json')); req.resolve('@playwright/test'); } catch { req = createRequire('D:/n64work/site-wt/package.json'); }
const { chromium } = req('@playwright/test');

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const METHOD = { 'matching-decomp': 'Matching decomp', 'non-matching-decomp': 'Decompilation', 'static-recomp': 'Static recomp', 'clean-room': 'Clean-room', rewrite: 'Rewrite', 'source-port': 'Source port', 'source-release': 'Source release', lift: 'Binary lift', 'emulation-hosted': 'Emulation-hosted', tool: 'Tool' };
const PROV = { 'human-led': 'Human-led', 'ai-assisted': 'AI-assisted', 'ai-generated': 'AI-generated', unknown: '' };
const card = ({ kicker, title, sub, chips = [], img }) => `<!doctype html><html><head>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@700&family=JetBrains+Mono:wght@500&display=swap" rel="stylesheet">
<style>body{position:relative;margin:0;width:1200px;height:630px;background:#0d100f;color:#e3ebe6;font-family:'Space Grotesk',sans-serif;display:flex;flex-direction:column;justify-content:space-between;padding:64px 72px;box-sizing:border-box;border-top:10px solid #3ee0a8}
.k{font:500 26px 'JetBrains Mono',monospace;color:#3ee0a8;letter-spacing:.06em;text-transform:uppercase}
h1{font-size:${img ? (title.length > 22 ? 52 : 68) : title.length > 34 ? 66 : 84}px;line-height:1.02;margin:18px 0 0;letter-spacing:-.025em;max-width:${img ? 560 : 1050}px}
.s{max-width:${img ? 560 : 1050}px}
.pic{position:absolute;right:64px;top:118px;width:460px;height:230px;object-fit:cover;border-radius:10px;border:2px solid #26302c;box-shadow:0 30px 60px -20px #000}
.s{font:500 28px 'JetBrains Mono',monospace;color:#9fb0a8;margin-top:22px}
.f{display:flex;justify-content:space-between;align-items:flex-end}.logo{font:700 44px 'JetBrains Mono',monospace}.logo b{color:#3ee0a8}
.c{display:flex;gap:14px}.c span{font:500 24px 'JetBrains Mono',monospace;border:2px solid #44524c;padding:6px 14px;border-radius:4px}</style></head>
<body>${img ? `<img class="pic" src="${img}">` : ''}<div><div class="k">${esc(kicker)}</div><h1>${esc(title)}</h1>${sub ? `<div class="s">${esc(sub)}</div>` : ''}</div>
<div class="f"><div class="logo"><b>&lt;</b>recomp<b>/&gt;</b></div><div class="c">${chips.filter(Boolean).map((c) => `<span>${esc(c)}</span>`).join('')}</div></div></body></html>`;

const browser = await chromium.launch({ channel: 'msedge' });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
const render = async (html, file) => { await page.setContent(html, { waitUntil: 'networkidle' }); await page.screenshot({ path: path.join(OUT, file), type: 'jpeg', quality: 82 }); };
await render(card({ kicker: 'Decomp · Recomp · Clean-room · Preservation', title: 'Every game and program being rebuilt from its binary, tracked live.', chips: ['recompsoftware.com'] }), 'default.jpg');
let n = 1;
if (!process.argv.includes('--only')) {
  for (const f of fs.readdirSync(path.join(ROOT, 'data/projects')).filter((f) => f.endsWith('.json'))) {
    for (const p of JSON.parse(fs.readFileSync(path.join(ROOT, 'data/projects', f), 'utf8'))) {
      const file = `p-${p.slug}.jpg`;
      // The project's own thumbnail (scripts/fetch-media.mjs) goes on the card; re-render when it is newer than the card.
      const thumb = path.join(ROOT, 'apps/web/public/thumbs', `${p.slug}.webp`);
      const hasThumb = fs.existsSync(thumb);
      const out = path.join(OUT, file);
      if (fs.existsSync(out) && !process.argv.includes('--force') && !(hasThumb && fs.statSync(thumb).mtimeMs > fs.statSync(out).mtimeMs)) continue;
      const img = hasThumb ? `data:image/webp;base64,${fs.readFileSync(thumb).toString('base64')}` : undefined;
      await render(card({ kicker: `${p.originalPlatform}${p.originalYear ? ' · ' + p.originalYear : ''}`, title: p.name, sub: p.subject !== p.name ? p.subject : '', chips: [METHOD[p.method], PROV[p.provenance], p.status], img }), file);
      n++;
    }
  }
}
await browser.close();
console.log(`og: ${n} cards -> ${path.relative(ROOT, OUT)}`);
