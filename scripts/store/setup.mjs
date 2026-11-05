// Store products on Printify (API shop) -> data/store.json + apps/web/public/store/*.jpg mockups.
// Token: PRINTIFY_TOKEN env or ~/.printify_token (Printify > Account > Connections). Art: python3 scripts/store/art/render.py
// Usage: node scripts/store/setup.mjs --plan     choose catalog items + print providers, print what would be made (no writes)
//        node scripts/store/setup.mjs --create [--update]   upload art, create missing products (matched by title); --update also re-pushes existing ones
//        node scripts/store/setup.mjs --sync     read the shop's products, download mockups, write data/store.json
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const ART = path.join(ROOT, 'scripts/store/art');
const PUB = path.join(ROOT, 'apps/web/public/store');
const STORE = path.join(ROOT, 'data/store.json');
const token = (process.env.PRINTIFY_TOKEN || fs.readFileSync(path.join(os.homedir(), '.printify_token'), 'utf8')).trim();
const mode = process.argv[2];
const UPDATE = process.argv.includes('--update');

// What we sell. find: catalog title test; color: variant colour to enable (null = any); sizes: allowed sizes (null = all);
// art: [file, x, y, scale, position?] per image (x/y = centre, 0-1; scale = share of placeholder width; position defaults to the front placeholder).
const PRODUCTS = [
  { slug: 'tee', name: 'recomp software tee', cents: 3000, find: /^Unisex Jersey Short Sleeve Tee$/i, color: /^black$/i, sizes: /^(S|M|L|XL|2XL|3XL)$/,
    blurb: 'Soft Bella+Canvas 3001 cotton tee, green terminal type on black.', art: [['lockup-green.png', 0.5, 0.28, 0.82]] },
  { slug: 'hoodie', name: 'recomp software hoodie', cents: 5000, find: /^Unisex Heavy Blend™ Hooded Sweatshirt$/i, color: /^black$/i, sizes: /^(S|M|L|XL|2XL|3XL)$/,
    blurb: 'Gildan 18500 heavy blend hoodie, green terminal type on black.', art: [['lockup-green.png', 0.5, 0.32, 0.7]] },
  { slug: 'mug', name: 'recomp software mug', cents: 2000, find: /^Black Mug \(11oz, 15oz\)$|^Black Mug.*11oz/i, color: null, sizes: /11\s?oz/i,
    blurb: '11oz black ceramic mug with the lockup on the front.', art: [['mug-green.png', 0.5, 0.5, 0.4]] },
  { slug: 'stickers-4', name: 'recomp sticker 4-pack', was: 'recomp sticker pack', cents: 800, find: /^Sticker Sheets$/i, color: null, sizes: /^6" × 4" \/ White/,
    blurb: '6" × 4" die-cut sheet of 4: CRT monitor, floppy disk, terminal and the lockup.',
    art: [1, 2, 3, 4].map((k) => [`sheet4-${k}.png`, 0.5, 0.5, 1, `front_${k}`]) },
  { slug: 'stickers-10', name: 'recomp sticker 10-pack', cents: 1500, find: /^Sticker Sheets$/i, color: null, sizes: /^11" × 8\.5" \/ White/,
    blurb: '11" × 8.5" die-cut sheet of 10: CRT, floppy, terminal, chip, assembly, disc, 100% matching, NO ROMs and more.',
    art: [1, 2, 3, 4].map((k) => [`sheet10-${k}.png`, 0.5, 0.5, 1, `front_${k}`]) },
  { slug: 'tee-battlestation', name: 'battle station tee', cents: 3000, find: /^Unisex Jersey Short Sleeve Tee$/i, color: /^black$/i, sizes: /^(S|M|L|XL|2XL|3XL)$/,
    blurb: 'A rendered retro battle station (beige CRTs, tower, floppies) over the lockup. Bella+Canvas 3001, black.', art: [['shirt-battlestation.png', 0.5, 0.5, 1]] },
  { slug: 'tee-crtwall', name: 'CRT wall tee', cents: 3000, find: /^Unisex Jersey Short Sleeve Tee$/i, color: /^black$/i, sizes: /^(S|M|L|XL|2XL|3XL)$/,
    blurb: 'A rendered stack of CRTs, each running a different screen, over the lockup. Bella+Canvas 3001, black.', art: [['shirt-crtwall.png', 0.5, 0.5, 1]] },
];

const api = async (p, body, method) => {
  for (let t = 0; t < 4; t++) {
    const r = await fetch(`https://api.printify.com/v1/${p}`, {
      method: method ?? (body ? 'POST' : 'GET'),
      headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json', 'User-Agent': 'recompsoftware-store' },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (r.status === 429) { await new Promise((res) => setTimeout(res, 5000 * (t + 1))); continue; }
    const text = await r.text();
    if (!r.ok) throw new Error(`${p}: ${r.status} ${text.slice(0, 400)}`);
    return text ? JSON.parse(text) : {};
  }
  throw new Error(`${p}: rate limited`);
};

async function shopId() {
  const shops = await api('shops.json');
  const s = shops.find((x) => /custom|api/i.test(x.sales_channel)) ?? (shops.length === 1 ? shops[0] : null);
  if (!s) throw new Error(`no API shop among ${JSON.stringify(shops)}`);
  return s.id;
}

// Pick a blueprint and the provider with the most matching variants (US providers first).
async function plan() {
  const blueprints = await api('catalog/blueprints.json');
  const out = [];
  for (const p of PRODUCTS) {
    const bp = blueprints.find((b) => p.find.test(b.title));
    if (!bp) { out.push({ ...p, error: `no blueprint matching ${p.find}` }); continue; }
    let best = null;
    for (const pp of await api(`catalog/blueprints/${bp.id}/print_providers.json`)) {
      const { variants } = await api(`catalog/blueprints/${bp.id}/print_providers/${pp.id}/variants.json`);
      const ok = variants.filter((v) => (!p.color || p.color.test(v.options?.color ?? '')) && (!p.sizes || p.sizes.test(v.options?.size ?? '') || p.sizes.test(v.title)));
      const front = ok[0]?.placeholders?.find((x) => x.position === 'front') ?? ok[0]?.placeholders?.[0];
      const score = ok.length * 10 + (pp.location?.country === 'US' ? 5 : 0);
      if (ok.length && front && (!best || score > best.score)) best = { score, provider: pp, variants: ok, placeholder: front };
      await new Promise((r) => setTimeout(r, 300));
    }
    if (!best) { out.push({ ...p, blueprint: bp, error: 'no provider has matching variants' }); continue; }
    out.push({ ...p, blueprint: bp, ...best });
  }
  return out;
}

const show = (pl) => pl.forEach((p) => console.log(p.error ? `! ${p.slug}: ${p.error}` :
  `${p.slug}: blueprint ${p.blueprint.id} "${p.blueprint.title}" (${p.blueprint.brand} ${p.blueprint.model}) via ${p.provider.title} [${p.provider.location?.country ?? '?'}]; ` +
  `${p.variants.length} variants (${p.variants.map((v) => v.title).join(', ')}); print area ${p.placeholder.position} ${p.placeholder.width}x${p.placeholder.height}`));

async function create() {
  const shop = await shopId();
  const existing = (await api(`shops/${shop}/products.json?limit=50`)).data ?? [];
  const uploads = {};
  for (const p of await plan()) {
    if (p.error) { console.log(`! skip ${p.slug}: ${p.error}`); continue; }
    const have = existing.find((e) => e.title === p.name || (p.was && e.title === p.was));
    if (have && !UPDATE) { console.log(`= ${p.slug} exists (--update to push art, title and prices)`); continue; }
    for (const [f] of p.art) uploads[f] ??= (await api('uploads/images.json', { file_name: f, contents: fs.readFileSync(path.join(ART, f)).toString('base64') })).id;
    const body = {
      title: p.name,
      description: `${p.blurb} Supports recompsoftware.com, the decomp & recomp tracker.`,
      variants: p.variants.map((v) => ({ id: v.id, price: p.cents, is_enabled: true })),
      print_areas: [{ variant_ids: p.variants.map((v) => v.id), placeholders: Object.entries(Object.groupBy(p.art, (a) => a[4] ?? p.placeholder.position))
        .map(([position, imgs]) => ({ position, images: imgs.map(([f, x, y, scale]) => ({ id: uploads[f], x, y, scale, angle: 0 })) })) }],
    };
    if (have) {
      // an update must list every variant of the blueprint/provider in print_areas, enabled or not
      const all = (await api(`shops/${shop}/products/${have.id}.json`)).variants;
      body.variants = all.map((v) => ({ id: v.id, price: p.cents, is_enabled: p.variants.some((x) => x.id === v.id) }));
      body.print_areas[0].variant_ids = all.map((v) => v.id);
      await api(`shops/${shop}/products/${have.id}.json`, body, 'PUT'); console.log(`~ ${p.slug}: updated ${have.id}`);
    } else {
      const prod = await api(`shops/${shop}/products.json`, { ...body, blueprint_id: p.blueprint.id, print_provider_id: p.provider.id });
      console.log(`+ ${p.slug}: product ${prod.id}`);
    }
  }
}

async function sync() {
  const shop = await shopId();
  const live = (await api(`shops/${shop}/products.json?limit=50`)).data ?? [];
  const data = JSON.parse(fs.readFileSync(STORE, 'utf8'));
  fs.mkdirSync(PUB, { recursive: true });
  data.products = [];
  const ORDER = ['tee-battlestation', 'tee-crtwall', 'tee', 'hoodie', 'stickers-10', 'stickers-4', 'mug'];  // store page order
  for (const p of [...PRODUCTS].sort((a, b) => ORDER.indexOf(a.slug) - ORDER.indexOf(b.slug))) {
    const prod = live.find((e) => e.title === p.name);
    if (!prod) { console.log(`! ${p.slug}: not on Printify yet (run --create)`); continue; }
    const SIZES = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL'];
    const rank = (t) => { const i = t.split(' / ').findIndex((x) => SIZES.includes(x)); return i < 0 ? 0 : SIZES.indexOf(t.split(' / ')[i]); };
    const enabled = prod.variants.filter((v) => v.is_enabled).sort((a, b) => rank(a.title) - rank(b.title));
    // mockups: default first, front views, at most 4
    const shots = [...prod.images].sort((a, b) => (b.is_default - a.is_default) || (a.position === 'front' ? -1 : 1)).slice(0, 4);
    const images = [];
    for (const [k, im] of shots.entries()) {
      const r = await fetch(im.src);
      if (!r.ok) continue;
      const f = `${p.slug}-${k + 1}.jpg`;
      fs.writeFileSync(path.join(PUB, f), Buffer.from(await r.arrayBuffer()));
      images.push(`/store/${f}`);
    }
    data.products.push({
      slug: p.slug, name: p.name, blurb: p.blurb, cents: p.cents, printifyId: prod.id,
      image: images[0] ?? null, images,
      variants: enabled.map((v) => ({ id: v.id, title: v.title, ...(v.is_available === false && { available: false }) })),
    });
    console.log(`~ ${p.slug}: ${enabled.length} variants, ${images.length} mockups`);
  }
  fs.writeFileSync(STORE, JSON.stringify(data, null, 2) + '\n');
  console.log(`shop ${shop}: set PRINTIFY_SHOP_ID = "${shop}" in apps/web/wrangler.jsonc vars`);
}

if (mode === '--plan') show(await plan());
else if (mode === '--create') await create();
else if (mode === '--sync') await sync();
else console.log('usage: node scripts/store/setup.mjs --plan | --create | --sync');
