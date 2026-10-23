import { projects, statsFor } from '../lib/data';

// Newest releases across every tracked project: a reason for readers to come back.
const esc = (s: string) => s.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]!);

export function GET() {
  const rows = projects()
    .map((p) => ({ p, r: statsFor(p)?.release ?? p.latestRelease }))
    .filter((x) => x.r?.date && x.r.version)
    .sort((a, b) => b.r!.date!.localeCompare(a.r!.date!))
    .slice(0, 60);
  const items = rows.map(({ p, r }) => {
    const url = `https://recompsoftware.com/p/${p.slug}/`;
    return `<item><title>${esc(`${p.name} ${r!.version}`)}</title><link>${url}</link><guid isPermaLink="false">${esc(`${p.slug} ${r!.version}`)}</guid><pubDate>${new Date(r!.date!).toUTCString()}</pubDate><category>${esc(p.originalPlatform)}</category><description>${esc(p.summary)}</description></item>`;
  }).join('');
  const xml = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Recomp: new releases</title><link>https://recompsoftware.com/this-week/</link><description>The latest releases of decompilation, recompilation and clean-room projects tracked by Recomp.</description>${items}</channel></rss>`;
  return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } });
}
