import { copyFileSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
const version = JSON.parse(readFileSync('package.json', 'utf8')).version;
const destination = resolve('release', `daybook-source-${version}`);
// This is an allowlist, not a zip of the working directory. Local evidence/data are never copied.
const roots = ['.gitignore', '.gitattributes', '.npmrc', '.nvmrc', 'package.json', 'package-lock.json', 'index.html', 'tsconfig.json', 'tsconfig.electron.json', 'vite.config.ts', 'README.md', 'VERIFICATION.md', 'SECURITY.md', 'RELEASING.md', 'THIRD_PARTY_NOTICES.md', 'LICENSE'];
for (const path of roots) if (!existsSync(path)) throw new Error(`Required public file is missing: ${path}`);
const files = [...roots];
for (const directory of ['electron', 'src', 'scripts', 'tests', '.github']) {
  if (!existsSync(directory)) continue;
  const visit = path => {
    for (const name of readdirSync(path)) {
      const item = join(path, name), stat = lstatSync(item);
      if (stat.isSymbolicLink()) throw new Error(`Symlink must not be exported: ${item}`);
      if (stat.isDirectory()) visit(item);
      else if (/\.(ts|tsx|cts|mjs|css|yml|yaml)$/.test(name)) files.push(item);
    }
  };
  visit(directory);
}
files.push('assets/icon.png', 'assets/icon.ico', 'assets/reminder.wav');
if (existsSync(destination)) throw new Error('The export directory already exists. Review it before choosing a new release version or directory.');
const home = process.env.USERPROFILE ?? process.env.HOME;
for (const path of files) {
  if (lstatSync(path).isSymbolicLink()) throw new Error(`Symlink must not be exported: ${path}`);
  if (!['.png', '.ico', '.wav'].includes(extname(path))) {
    const text = readFileSync(path, 'utf8');
    const forbidden = [/-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/, /\bgh[pousr]_[A-Za-z0-9]{30,}\b/, /\bgithub_pat_[A-Za-z0-9_]{30,}\b/, /\bAKIA[A-Z0-9]{16}\b/];
    if (forbidden.some(pattern => pattern.test(text))) throw new Error(`Possible secret in ${path}; review without publishing.`);
    if (home && [home, home.replaceAll('\\', '/'), home.replaceAll('\\', '\\\\')].some(value => text.includes(value))) throw new Error(`Local home path in ${path}; review without publishing.`);
  }
}
for (const path of files) { const target = join(destination, path); mkdirSync(dirname(target), { recursive: true }); copyFileSync(path, target); }
writeFileSync(join(destination, 'SOURCE_MANIFEST.json'), JSON.stringify({ version, files: files.map(path => path.replaceAll('\\', '/')).sort() }, null, 2));
console.log(`Exported ${files.length} reviewed source files to release/daybook-source-${version}`);
