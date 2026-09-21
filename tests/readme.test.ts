import { test } from 'node:test';
import assert from 'node:assert/strict';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const readmes = ['README.md', 'README.zh-CN.md', 'README.en.md', 'README.ja.md', 'README.ko.md'];
const screenshots = ['docs/images/daybook-overview.png', 'docs/images/daybook-reminder2.png'];
const read = (path: string) => readFileSync(path, 'utf8');

test('five README languages link to each other and share working install instructions', () => {
  const original = read('README.md');
  const commands = original.match(/```powershell\r?\n([\s\S]*?)```/)?.[1].replaceAll('\r\n', '\n');
  assert.ok(commands);
  for (const path of readmes) {
    const content = read(path), navigation = content.split(/\r?\n/)[0];
    for (const other of readmes.filter(other => other !== path)) assert.ok(navigation.includes(`](${other})`), `${path} must link to ${other}`);
    assert.equal(content.match(/^## /gm)?.length, 4, path);
    const quickStart = content.split(/^## /m)[3];
    assert.equal(quickStart.match(/^\d\. /gm)?.length, 4, `${path}: four concise usage steps`);
    const introduction = content.split(/^## /m)[0];
    assert.ok(introduction.indexOf(screenshots[0]) > introduction.indexOf('License-MIT'), `${path}: overview below badges`);
    assert.ok(quickStart.includes(screenshots[1]), `${path}: reminder in usage section`);
    assert.equal(content.match(/```powershell\r?\n([\s\S]*?)```/)?.[1].replaceAll('\r\n', '\n'), commands, path);
    assert.ok(content.includes('https://github.com/Casanova033822/daybook-secretary/releases/latest'), path);
    assert.ok(content.includes('Node.js 24.x') && content.includes('Windows 11 x64'), path);
    assert.equal(content.match(/<details>/g)?.length, 1, path);
    assert.equal(content.match(/<\/details>/g)?.length, 1, path);
    const links = [...content.matchAll(/\]\(([^)]+)\)/g), ...content.matchAll(/(?:href|src)="([^"]+)"/g)];
    for (const [, link] of links) {
      if (/^https:\/\//.test(link)) continue;
      assert.ok(existsSync(resolve(dirname(path), link)), `${path}: missing ${link}`);
    }
  }
});

test('source exports preserve all five README files and both screenshots', () => {
  const manifest = JSON.parse(read('SOURCE_MANIFEST.json')) as { version: string; files: string[] };
  mkdirSync('test-results', { recursive: true });
  const fixture = mkdtempSync(resolve('test-results/readme-export-'));
  for (const path of manifest.files) {
    const target = join(fixture, path); mkdirSync(dirname(target), { recursive: true }); copyFileSync(path, target);
  }
  execFileSync(process.execPath, ['scripts/export-source.mjs'], { cwd: fixture, windowsHide: true, stdio: 'pipe' });
  const exported = join(fixture, 'release', `daybook-source-${manifest.version}`);
  const exportedManifest = JSON.parse(read(join(exported, 'SOURCE_MANIFEST.json'))) as { files: string[] };
  for (const path of [...readmes, ...screenshots]) {
    assert.ok(manifest.files.includes(path), path);
    assert.ok(exportedManifest.files.includes(path), path);
    assert.deepEqual(readFileSync(join(exported, path)), readFileSync(path), path);
  }
});
