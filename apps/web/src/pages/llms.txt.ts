import { projects, CATEGORIES, METHOD_LABEL, PROVENANCE_LABEL } from '../lib/data';

export function GET() {
  const all = projects();
  const body = [
    '# Recomp (recompsoftware.com)',
    '> A tracker for decompilation, static recompilation, clean-room reimplementation and software preservation projects, with provenance labels and daily GitHub activity.',
    '',
    '## Key pages',
    '- [Recompiled games list](https://recompsoftware.com/recompiled-games-list/): every static recomp PC port',
    '- [Decompiled games list](https://recompsoftware.com/decompiled-games-list/): every game decompilation',
    '- [Decomp progress tracker](https://recompsoftware.com/progress/): matched-code % for each decomp, with history',
    '- [Platforms](https://recompsoftware.com/platforms/): full lists of decomps, recomps and PC ports per console',
    '- [Play in browser](https://recompsoftware.com/play/): builds that run in a web page',
    '- [New releases (RSS)](https://recompsoftware.com/releases.xml)',
    '',
    ...CATEGORIES.flatMap((c) => [
      `## ${c.label}`,
      ...all.filter((p) => p.category === c.id).map((p) => `- [${p.name}](https://recompsoftware.com/p/${p.slug}/): ${METHOD_LABEL[p.method]}, ${PROVENANCE_LABEL[p.provenance]}, ${p.status}. ${p.summary}`),
      '',
    ]),
  ].join('\n');
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
