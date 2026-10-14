import { projects, CATEGORIES, METHOD_LABEL, PROVENANCE_LABEL } from '../lib/data';

export function GET() {
  const all = projects();
  const body = [
    '# Recomp (recompsoftware.com)',
    '> A tracker for decompilation, static recompilation, clean-room reimplementation and software preservation projects, with provenance labels and daily GitHub activity.',
    '',
    ...CATEGORIES.flatMap((c) => [
      `## ${c.label}`,
      ...all.filter((p) => p.category === c.id).map((p) => `- [${p.name}](https://recompsoftware.com/p/${p.slug}/): ${METHOD_LABEL[p.method]}, ${PROVENANCE_LABEL[p.provenance]}, ${p.status}. ${p.summary}`),
      '',
    ]),
  ].join('\n');
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
