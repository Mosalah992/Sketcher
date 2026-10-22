// Builds release/SepiaSketcher.exe: one file, resources embedded, branded with
// the app's icon and name.
//
// The branding goes onto Neutralino's stock binary in bin/ *before* `neu build`,
// because the build appends the resources to the end of the exe and rewriting
// its PE resources afterwards could drop that appended data.

import { execSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import rcedit from 'rcedit';

const root = fileURLToPath(new URL('..', import.meta.url));
const config = JSON.parse(readFileSync(`${root}neutralino.config.json`, 'utf8'));
const { version } = config;
const run = (cmd) => execSync(cmd, { cwd: root, stdio: 'inherit' });

const stock = `${root}bin/neutralino-win_x64.exe`;
if (!existsSync(stock) || !existsSync(`${root}resources/js/neutralino.js`)) run('npx neu update');

await rcedit(stock, {
  icon: `${root}scripts/app.ico`,
  'file-version': version,
  'product-version': version,
  'version-string': {
    ProductName: config.applicationName,
    FileDescription: config.applicationName,
    CompanyName: config.author,
    OriginalFilename: 'SepiaSketcher.exe',
    InternalName: 'SepiaSketcher',
    LegalCopyright: `${config.author}. Built with Neutralinojs (MIT).`,
  },
});

run('npx neu build --release --embed-resources --clean');

const built = `${root}dist/${config.cli.binaryName}/${config.cli.binaryName}-win_x64.exe`;
mkdirSync(`${root}release`, { recursive: true });
const out = `${root}release/SepiaSketcher.exe`;
copyFileSync(built, out);
console.log(`\n${out} (${(statSync(out).size / 1048576).toFixed(1)} MB)`);
