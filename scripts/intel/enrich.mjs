// Enrich .cache/harvest.json with latest release, README head and AI-build signals (CLAUDE.md / AGENTS.md / README wording).
// Usage: node scripts/intel/enrich.mjs  -> .cache/harvest-enriched.json
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const token = process.env.GITHUB_TOKEN || execSync('gh auth token').toString().trim();
const H = { 'User-Agent': 'recompsoftware-harvest/0.1', Authorization: `bearer ${token}` };
const cands = JSON.parse(fs.readFileSync(path.join(ROOT, '.cache/harvest.json'), 'utf8')).filter((x) => !x.via.every((v) => v.includes('game-datasets')));
const AI = /\b(claude|codex|chatgpt|gpt-[45]|copilot|cursor|llm|ai[- ](assisted|generated|written|agent)|made (almost )?(entirely|exclusively) with ai|vibe[- ]cod)/i;
const blob = (a, f) => `${a}: object(expression: "HEAD:${f}") { ... on Blob { text } }`;

for (let i = 0; i < cands.length; i += 25) {
  const chunk = cands.slice(i, i + 25);
  const q = `{${chunk.map((c, k) => { const [o, n] = c.name.split('/'); return `r${k}: repository(owner: ${JSON.stringify(o)}, name: ${JSON.stringify(n)}) { owner { login } latestRelease { tagName publishedAt } releases { totalCount } ${blob("rm1", "README.md")} ${blob("rm2", "readme.md")} ${blob("rm3", "README")} claude: object(expression: "HEAD:CLAUDE.md") { id } agents: object(expression: "HEAD:AGENTS.md") { id } }`; }).join(' ')}}`;
  let j;
  for (let t = 0; t < 3; t++) {
    try { j = await (await fetch('https://api.github.com/graphql', { method: 'POST', headers: H, body: JSON.stringify({ query: q }) })).json(); if (j.data) break; console.log(JSON.stringify(j.errors ?? j).slice(0, 200)); } catch {}
    await new Promise((r) => setTimeout(r, 5000));
  }
  chunk.forEach((c, k) => {
    const x = j?.data?.[`r${k}`];
    if (!x) return;
    const readme = (x.rm1 ?? x.rm2 ?? x.rm3)?.text ?? '';
    c.owner = x.owner.login;
    c.latestRelease = x.latestRelease ? { version: x.latestRelease.tagName, date: x.latestRelease.publishedAt.slice(0, 10) } : null;
    c.releases = x.releases.totalCount;
    c.aiFiles = [x.claude && 'CLAUDE.md', x.agents && 'AGENTS.md'].filter(Boolean);
    c.aiHits = [...new Set((readme.match(new RegExp(AI.source, 'gi')) ?? []).map((s) => s.toLowerCase()))];
    c.readme = readme.replace(/<[^>]+>/g, ' ').replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\s+/g, ' ').slice(0, 1200);
  });
  if (i % 250 === 0) console.log(`${i}/${cands.length}`);
}
fs.writeFileSync(path.join(ROOT, '.cache/harvest-enriched.json'), JSON.stringify(cands, null, 1));
console.log(`enriched ${cands.length}; with AI files ${cands.filter((c) => c.aiFiles?.length).length}; AI wording ${cands.filter((c) => c.aiHits?.length).length}`);
