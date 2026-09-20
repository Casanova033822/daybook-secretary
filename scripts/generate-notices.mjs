import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'));
const sections = ['# Third-party notices', 'The application bundles the following libraries. Their original license notices follow. Electron and Chromium license notices are also included beside the installed executable. System fonts are not redistributed.'];
for (const [path, entry] of Object.entries(lock.packages).sort(([a], [b]) => a.localeCompare(b))) {
  if (!path || entry.dev) continue;
  const pkg = JSON.parse(readFileSync(join(path, 'package.json'), 'utf8'));
  const licenseFile = readdirSync(path).find(name => /^licen[sc]e(?:\.(?:md|txt))?$/i.test(name));
  if (!licenseFile) throw new Error(`Missing license for ${pkg.name}; inspect before distributing.`);
  sections.push(`## ${pkg.name} ${pkg.version}\n\n${readFileSync(join(path, licenseFile), 'utf8').trim()}`);
}
sections.push(`## flag-icons 7.5.0\n\nBundled country/region SVG flags from https://github.com/lipis/flag-icons/tree/v7.5.0 (assets/flags).\n\n${readFileSync('assets/flags/LICENSE', 'utf8').trim()}`);
writeFileSync('THIRD_PARTY_NOTICES.md', `${sections.join('\n\n')}\n`);
console.log('Third-party license notices generated.');
