// Compact index for the header search box: [slug, name, subject, platform, category, stars], fetched on first focus.
import { projects, statsFor } from '../lib/data';

export function GET() {
  const rows = projects().map((p) => [p.slug, p.name, p.subject === p.name ? '' : p.subject, p.originalPlatform, p.category, statsFor(p)?.stars ?? 0]);
  return new Response(JSON.stringify(rows), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
}
