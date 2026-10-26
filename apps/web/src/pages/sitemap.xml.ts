import { projects, platforms, gameHubs, statsFor, CATEGORIES, type Project } from '../lib/data';

const pages = ['/', '/projects/', '/trending/', '/progress/', '/play/', '/history/', '/lineage/', '/news/', '/this-week/', '/platforms/', '/game/', '/recompiled-games-list/', '/decompiled-games-list/', '/what-is-a-recomp/', '/about/'];

// lastmod for a project page = newest of: entry checked, latest release, last push (all dates the page shows)
const lastmod = (p: Project) => {
  const s = statsFor(p);
  const d = [p.checked, p.latestRelease?.date, s?.release?.date, s?.pushedAt].filter(Boolean).map((x) => String(x).slice(0, 10)).sort().pop();
  return d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null;
};

export function GET() {
  const all = projects();
  const urls = [
    ...pages,
    ...CATEGORIES.map((c) => `/${c.id}/`),
    ...all.map((p) => [`/p/${p.slug}/`, lastmod(p)] as const),
    ...all.filter((p) => p.playable?.launch === 'frame').map((p) => `/play/${p.slug}/`),
    ...platforms().map((p) => `/platforms/${p.slug}/`),
    ...gameHubs().map((h) => `/game/${h.slug}/`),
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((u) => {
    const [loc, mod] = typeof u === 'string' ? [u, null] : u;
    return `<url><loc>https://recompsoftware.com${loc}</loc>${mod ? `<lastmod>${mod}</lastmod>` : ''}</url>`;
  }).join('')}</urlset>`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
}
