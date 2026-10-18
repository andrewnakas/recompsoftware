// One canonical name per original platform, so each gets one list page (old slugs redirect in public/_redirects).
import fs from 'node:fs';
const ALIAS = {
  'Super Nintendo': 'SNES', 'Super Famicom': 'SNES', 'Sega Genesis': 'Mega Drive / Genesis', 'Mega Drive': 'Mega Drive / Genesis',
  'Nintendo GameCube': 'GameCube', 'Nintendo Entertainment System': 'NES', 'Sega Dreamcast': 'Dreamcast',
  Macintosh: 'Classic Mac OS', 'Mac OS': 'Classic Mac OS', 'Mac OS Classic': 'Classic Mac OS',
  'J2ME (Nokia S40)': 'J2ME phones', 'Sega Mega Drive': 'Mega Drive / Genesis', 'Sega Mega Drive / Genesis': 'Mega Drive / Genesis', 'Genesis': 'Mega Drive / Genesis',
  Famicom: 'NES', 'Nintendo Famicom': 'NES', PSP: 'PlayStation Portable', 'Sony PlayStation': 'PlayStation', PS1: 'PlayStation', PSX: 'PlayStation',
  PS2: 'PlayStation 2', PS3: 'PlayStation 3', 'Nintendo Wii': 'Wii', 'Nintendo Wii U': 'Wii U', 'Microsoft Xbox': 'Xbox', 'Sega Model 2': 'Arcade (Sega Model 2)',
  'Flash/AIR': 'Web (Flash)', MSX2: 'MSX', 'BBC Master': 'BBC Micro', 'Nintendo Game Boy': 'Game Boy', 'Nintendo Game Boy Advance': 'Game Boy Advance', Unix: 'UNIX', 'Windows/Mac OS': 'Windows/macOS', 'Windows / Mac': 'Windows/macOS',
};
let n = 0;
for (const f of fs.readdirSync('data/projects').filter((f) => f.endsWith('.json'))) {
  const file = `data/projects/${f}`;
  const list = JSON.parse(fs.readFileSync(file, 'utf8'));
  for (const p of list) if (ALIAS[p.originalPlatform]) { p.originalPlatform = ALIAS[p.originalPlatform]; n++; }
  fs.writeFileSync(file, JSON.stringify(list, null, 2) + '\n');
}
console.log(`renamed ${n}`);
