import { projects, platforms, gameHubs, CATEGORIES } from '../lib/data';

const pages = ['/', '/projects/', '/trending/', '/progress/', '/play/', '/history/', '/lineage/', '/news/', '/this-week/', '/platforms/', '/game/', '/recompiled-games-list/', '/decompiled-games-list/', '/what-is-a-recomp/', '/about/'];

export function GET() {
  const all = projects();
  const urls = [
    ...pages,
    ...CATEGORIES.map((c) => `/${c.id}/`),
    ...all.map((p) => `/p/${p.slug}/`),
    ...all.filter((p) => p.playable?.launch === 'frame').map((p) => `/play/${p.slug}/`),
    ...platforms().map((p) => `/platforms/${p.slug}/`),
    ...gameHubs().map((h) => `/game/${h.slug}/`),
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((u) => `<url><loc>https://recompsoftware.com${u}</loc></url>`).join('')}</urlset>`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
}
