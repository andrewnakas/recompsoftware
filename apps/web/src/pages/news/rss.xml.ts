import { news } from '../../lib/data';

const esc = (s: string) => s.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]!);

export function GET() {
  const items = news().slice(0, 50).map((n) => `<item><title>${esc(n.title)}</title><link>${esc(n.source)}</link><guid isPermaLink="false">${esc(n.date + ' ' + n.title)}</guid><pubDate>${new Date(n.date).toUTCString()}</pubDate><description>${esc(n.body)}</description></item>`).join('');
  const xml = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Recomp news</title><link>https://recompsoftware.com/news/</link><description>Decompilation, recompilation and preservation news.</description>${items}</channel></rss>`;
  return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } });
}
