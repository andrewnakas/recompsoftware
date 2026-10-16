// One canonical name per original platform, so each gets one list page (old slugs redirect in public/_redirects).
import fs from 'node:fs';
const ALIAS = {
  'Super Nintendo': 'SNES', 'Super Famicom': 'SNES', 'Sega Genesis': 'Mega Drive / Genesis', 'Mega Drive': 'Mega Drive / Genesis',
  'Nintendo GameCube': 'GameCube', 'Nintendo Entertainment System': 'NES', 'Sega Dreamcast': 'Dreamcast',
  Macintosh: 'Classic Mac OS', 'Mac OS': 'Classic Mac OS', 'Mac OS Classic': 'Classic Mac OS',
  'J2ME (Nokia S40)': 'J2ME phones', Unix: 'UNIX', 'Windows/Mac OS': 'Windows/macOS', 'Windows / Mac': 'Windows/macOS',
};
let n = 0;
for (const f of fs.readdirSync('data/projects').filter((f) => f.endsWith('.json'))) {
  const file = `data/projects/${f}`;
  const list = JSON.parse(fs.readFileSync(file, 'utf8'));
  for (const p of list) if (ALIAS[p.originalPlatform]) { p.originalPlatform = ALIAS[p.originalPlatform]; n++; }
  fs.writeFileSync(file, JSON.stringify(list, null, 2) + '\n');
}
console.log(`renamed ${n}`);
