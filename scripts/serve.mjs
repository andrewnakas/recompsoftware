// Static server for apps/web/dist (preview + audits). Usage: node scripts/serve.mjs [port]
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const DIST = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../apps/web/dist');
const T = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.xml': 'application/xml', '.txt': 'text/plain', '.png': 'image/png', '.json': 'application/json' };
const port = Number(process.argv[2]) || 4379;
http.createServer((q, r) => {
  let f = path.join(DIST, decodeURIComponent(q.url.split('?')[0]));
  if (fs.statSync(f, { throwIfNoEntry: false })?.isDirectory()) f = path.join(f, 'index.html');
  const ok = fs.existsSync(f);
  r.writeHead(ok ? 200 : 404, { 'Content-Type': T[path.extname(ok ? f : '.html')] ?? 'application/octet-stream' });
  r.end(fs.readFileSync(ok ? f : path.join(DIST, '404.html')));
}).listen(port, () => console.log(`serving dist on http://127.0.0.1:${port}`));
