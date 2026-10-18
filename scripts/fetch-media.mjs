// Each repo's own picture -> data/media.json: its custom GitHub social preview, else the first image in its README.
// Thumbnails (640x320 webp) go to apps/web/public/thumbs/<slug>.webp; only re-made when the source URL changes.
// Usage: node scripts/fetch-media.mjs [--limit N] [--no-thumbs] [--force-thumbs]
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = process.env.RECOMP_DATA ?? path.join(ROOT, 'data');
const THUMBS = path.join(ROOT, 'apps/web/public/thumbs');
const token = process.env.GITHUB_TOKEN || execSync('gh auth token').toString().trim();
const limit = Number(process.argv[process.argv.indexOf('--limit') + 1]) || Infinity;
const H = { Authorization: `bearer ${token}`, 'User-Agent': 'recompsoftware' };

const projects = fs.readdirSync(path.join(DATA, 'projects')).filter((f) => f.endsWith('.json'))
  .flatMap((f) => JSON.parse(fs.readFileSync(path.join(DATA, 'projects', f), 'utf8')))
  .filter((p) => /github\.com\/[^/]+\/[^/#?]+/i.test(p.repo ?? '')).slice(0, limit);
const prev = fs.existsSync(path.join(DATA, 'media.json')) ? JSON.parse(fs.readFileSync(path.join(DATA, 'media.json'), 'utf8')) : {};

// First markdown/HTML image in the README that is not a badge, made absolute against the repo.
const BADGE = /shields\.io|badge|travis-ci|appveyor|codecov|circleci|discord(app)?\.com\/api|img\.youtube|ko-fi|patreon|buymeacoffee|liberapay|\.svg(\?|$)|github\.com\/[^/]+\/[^/]+\/(actions|workflows)/i;
function readmeImage(md, owner, name, branch) {
  const urls = [...md.matchAll(/!\[[^\]]*\]\(\s*<?([^)\s>]+)/g), ...md.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)]
    .sort((a, b) => a.index - b.index).map((m) => m[1]);
  for (let u of urls) {
    if (BADGE.test(u)) continue;
    if (u.startsWith('//')) u = 'https:' + u;
    else if (!/^https?:/i.test(u)) u = `https://raw.githubusercontent.com/${owner}/${name}/${branch}/${u.replace(/^\.?\//, '')}`;
    u = u.replace(/^https:\/\/github\.com\/([^/]+)\/([^/]+)\/(blob|raw)\//, 'https://raw.githubusercontent.com/$1/$2/');
    return u;
  }
  return null;
}

const media = {};
for (let i = 0; i < projects.length; i += 25) {
  const chunk = projects.slice(i, i + 25).map((p) => ({ p, m: p.repo.match(/github\.com\/([^/]+)\/([^/#?]+)/i) }));
  const q = `{${chunk.map(({ m }, k) => { const o = m[1], n = m[2].replace(/\.git$/, ''); return `r${k}: repository(owner: ${JSON.stringify(o)}, name: ${JSON.stringify(n)}) { openGraphImageUrl usesCustomOpenGraphImage defaultBranchRef { name } a: object(expression: "HEAD:README.md") { ... on Blob { text } } b: object(expression: "HEAD:readme.md") { ... on Blob { text } } }`; }).join(' ')}}`;
  let j;
  for (let t = 0; t < 3 && !j?.data; t++) { try { j = await (await fetch('https://api.github.com/graphql', { method: 'POST', headers: H, body: JSON.stringify({ query: q }) })).json(); } catch {} if (!j?.data) await new Promise((r) => setTimeout(r, 5000)); }
  chunk.forEach(({ p, m }, k) => {
    const r = j?.data?.[`r${k}`];
    if (!r) return;
    const img = r.usesCustomOpenGraphImage ? r.openGraphImageUrl : readmeImage((r.a ?? r.b)?.text ?? '', m[1], m[2].replace(/\.git$/, ''), r.defaultBranchRef?.name ?? 'HEAD');
    if (img) media[p.slug] = { src: img, kind: r.usesCustomOpenGraphImage ? 'social' : 'readme' };
  });
}

let made = 0, kept = 0, failed = 0;
if (!process.argv.includes('--no-thumbs')) {
  let sharp;
  for (const base of [ROOT, path.join(ROOT, 'apps/web')]) { try { sharp = createRequire(path.join(base, 'package.json'))('sharp'); break; } catch {} }
  fs.mkdirSync(THUMBS, { recursive: true });
  const slugs = Object.keys(media);
  for (let i = 0; i < slugs.length; i += 8) {
    await Promise.all(slugs.slice(i, i + 8).map(async (slug) => {
      const f = path.join(THUMBS, `${slug}.webp`);
      if (!process.argv.includes('--force-thumbs') && prev[slug]?.src === media[slug].src && prev[slug]?.thumb && fs.existsSync(f)) { media[slug].thumb = prev[slug].thumb; kept++; return; }
      try {
        const r = await fetch(media[slug].src, { headers: { 'User-Agent': 'recompsoftware' }, signal: AbortSignal.timeout(20000) });
        if (!r.ok || !/^image\//.test(r.headers.get('content-type') ?? 'image/')) throw new Error(r.status);
        const img = sharp(Buffer.from(await r.arrayBuffer()), { animated: false });
        const meta = await img.metadata();
        if ((meta.width ?? 0) < 160 || (meta.height ?? 0) < 90) throw new Error('too small'); // logos and icons read badly as covers
        const ratio = meta.width / meta.height;
        if (ratio > 1.5 && ratio < 2.6) await img.resize(640, 320, { fit: 'cover', position: 'attention' }).webp({ quality: 72 }).toFile(f);
        else {
          // Banners, logos and tall shots: show the whole image over a blurred, darkened copy of itself instead of cropping.
          const buf = await img.toBuffer();
          const bg = await sharp(buf).resize(640, 320, { fit: 'cover' }).blur(24).modulate({ brightness: 0.55 }).toBuffer();
          const fg = await sharp(buf).resize(600, 296, { fit: 'inside', withoutEnlargement: false }).toBuffer();
          await sharp(bg).composite([{ input: fg, gravity: 'center' }]).webp({ quality: 72 }).toFile(f);
        }
        media[slug].thumb = `/thumbs/${slug}.webp`; made++;
      } catch { failed++; }
    }));
  }
  // Drop thumbnails for projects that no longer have a picture.
  for (const f of fs.readdirSync(THUMBS)) if (!media[f.replace(/\.webp$/, '')]?.thumb) fs.unlinkSync(path.join(THUMBS, f));
} else for (const [s, v] of Object.entries(prev)) if (media[s]?.src === v.src && v.thumb) media[s].thumb = v.thumb;

const sorted = Object.fromEntries(Object.entries(media).sort(([a], [b]) => a.localeCompare(b)));
fs.writeFileSync(path.join(DATA, 'media.json'), JSON.stringify(sorted, null, 0) + '\n');
const v = Object.values(media);
console.log(`fetch-media: ${projects.length} repos, ${v.filter((x) => x.kind === 'social').length} social previews, ${v.filter((x) => x.kind === 'readme').length} README images; thumbs ${made} new, ${kept} kept, ${failed} failed`);
