// Intel sweep: GitHub discovery + Reddit + news RSS -> data/inbox/<date>-sweep.json (leads for review, never published directly).
// Usage: node scripts/intel/sweep.mjs [--days 7]
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const DATA = path.join(ROOT, 'data');
const days = Number(process.argv[process.argv.indexOf('--days') + 1]) || 7;
const sinceMs = Date.now() - days * 864e5;
const since = new Date(sinceMs).toISOString().slice(0, 10);
const UA = { 'User-Agent': 'recompsoftware-intel/0.1 (+https://recompsoftware.com/about/)' };
const token = process.env.GITHUB_TOKEN || execSync('gh auth token').toString().trim();
const sources = JSON.parse(fs.readFileSync(path.join(DATA, 'sources/feeds.json'), 'utf8'));
const KEY = new RegExp(sources.keywords.join('|'), 'i');

// Repos already in the catalogue, so discovery only reports new ones.
const known = new Set();
for (const f of fs.readdirSync(path.join(DATA, 'projects')).filter((f) => f.endsWith('.json')))
  for (const p of JSON.parse(fs.readFileSync(path.join(DATA, 'projects', f), 'utf8'))) if (p.repo) known.add(p.repo.toLowerCase().replace(/\/$/, ''));

const seenFile = path.join(DATA, 'sources/seen.json');
const seen = new Set(fs.existsSync(seenFile) ? JSON.parse(fs.readFileSync(seenFile, 'utf8')) : []);
const leads = [];
const add = (l) => { if (seen.has(l.url)) return; seen.add(l.url); leads.push(l); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// GitHub: new or newly-hot repos matching scene queries.
for (const q of sources.github) {
  const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(`${q} pushed:>=${since}`)}&sort=stars&order=desc&per_page=30`;
  const r = await fetch(url, { headers: { ...UA, Authorization: `bearer ${token}`, Accept: 'application/vnd.github+json' } });
  const j = await r.json();
  for (const it of j.items ?? []) {
    if (known.has(it.html_url.toLowerCase())) continue;
    if (it.stargazers_count < sources.minStars || /^awesome/i.test(it.name)) continue;
    add({ source: 'github', query: q, title: it.full_name, url: it.html_url, date: it.created_at.slice(0, 10), score: it.stargazers_count, text: it.description ?? '', isNewRepo: Date.parse(it.created_at) > sinceMs });
  }
  await sleep(2500); // search API: 30 req/min
}

// Reddit: the public JSON API answers anonymous clients with an HTML wall, the Atom feeds work.
const feeds = [...sources.reddit.map((sub) => ({ name: `reddit/r/${sub}`, url: `https://www.reddit.com/r/${sub}/new/.rss?limit=100` })), ...sources.rss];

// RSS / Atom: news sites and Hacker News / lobste.rs.
const decode = (s) => s.replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const tag = (x, t) => x.match(new RegExp(`<${t}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</${t}>`, 'i'))?.[1]?.trim() ?? '';
for (const feed of feeds) {
  try {
    const x = await (await fetch(feed.url, { headers: UA })).text();
    for (const it of x.split(/<item[\s>]|<entry[\s>]/i).slice(1)) {
      const title = decode(tag(it, 'title').replace(/<[^>]+>/g, ''));
      const link = tag(it, 'link') || it.match(/<link[^>]*href="([^"]+)"/i)?.[1] || '';
      const date = new Date(tag(it, 'pubDate') || tag(it, 'updated') || tag(it, 'published') || Date.now());
      if (date.getTime() < sinceMs) continue;
      const text = `${title} ${(tag(it, 'description') || tag(it, 'content')).replace(/&lt;[^]*?&gt;|<[^>]+>/g, ' ')}`;
      if (feed.filter !== false && !KEY.test(text)) continue;
      add({ source: feed.name, title, url: link, date: date.toISOString().slice(0, 10), text: text.slice(0, 300) });
    }
  } catch (e) { console.log(`  rss ${feed.name}: ${e.message}`); }
  if (feed.name.startsWith('reddit')) await sleep(1500);
}

const today = new Date().toISOString().slice(0, 10);
fs.mkdirSync(path.join(DATA, 'inbox'), { recursive: true });
const out = path.join(DATA, 'inbox', `${today}-sweep.json`);
fs.writeFileSync(out, JSON.stringify(leads.sort((a, b) => (b.score ?? 0) - (a.score ?? 0)), null, 1));
fs.writeFileSync(seenFile, JSON.stringify([...seen].slice(-20000)));
const by = leads.reduce((m, l) => ((m[l.source.split('/')[0]] = (m[l.source.split('/')[0]] ?? 0) + 1), m), {});
console.log(`sweep: ${leads.length} new leads since ${since} -> ${path.relative(ROOT, out)}  ${JSON.stringify(by)}`);
