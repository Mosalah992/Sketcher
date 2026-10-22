// Draws the app icon: the archive's Altmer race sketch (icon-portrait.webp)
// inked onto a sheet of paper (icon.svg) inside an ink frame (icon-frame.svg).
// Writes the window icon (resources/icons/appIcon.png) and the .exe's icon
// (scripts/app.ico). Run after changing any of those; both outputs are committed.

import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import pngToIco from 'png-to-ico';
import sharp from 'sharp';

const at = (p) => fileURLToPath(new URL(p, import.meta.url));
const S = 1024; // drawn large, then scaled down for each size
const svg = (name) => sharp(at(name), { density: (72 * S) / 256 }).resize(S, S).png().toBuffer();

// The bust, head and shoulders, fitted inside the frame and anchored to its foot.
const inner = Math.round((S * 206) / 256);
const portrait = await sharp(at('./icon-portrait.webp'))
  .extract({ left: 40, top: 0, width: 520, height: 572 })
  .resize({ height: inner })
  .png()
  .toBuffer();
const { width: pw } = await sharp(portrait).metadata();

const master = await sharp(await svg('./icon.svg'))
  .composite([
    { input: portrait, left: Math.round((S - pw) / 2), top: S - Math.round((S * 23) / 256) - inner, blend: 'multiply' },
    { input: await svg('./icon-frame.svg') },
  ])
  .png()
  .toBuffer();

const png = (size) => sharp(master).resize(size, size, { kernel: 'lanczos3' }).png().toBuffer();
await writeFile(at('../resources/icons/appIcon.png'), await png(256));
await writeFile(at('./app.ico'), await pngToIco(await Promise.all([16, 24, 32, 48, 64, 256].map(png))));
console.log('icons written');
