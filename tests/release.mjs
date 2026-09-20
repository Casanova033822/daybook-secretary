import { chromium, expect } from '@playwright/test';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
import { createServer as httpServer } from 'node:http';
import { createServer as tcpServer, createConnection } from 'node:net';
import assert from 'node:assert/strict';

const executable = resolve(process.argv[2] ?? 'release/win-unpacked/日序.exe');
assert.ok(existsSync(executable), 'Build the release first: npm run dist');
mkdirSync('test-results', { recursive: true });
const data = mkdtempSync(resolve('test-results/release-'));
const marker = join(data, 'injected.txt'), injected = join(data, 'injection.cjs');
writeFileSync(injected, `require('node:fs').writeFileSync(${JSON.stringify(marker)}, 'injected');`);
const privateFile = join(data, 'outside-renderer.txt');
writeFileSync(privateFile, 'synthetic private file');
let externalRequests = 0;
const external = httpServer((_request, response) => { externalRequests++; response.end('<html>untrusted</html>'); });
await new Promise(resolve => external.listen(0, '127.0.0.1', resolve));
const externalUrl = `http://127.0.0.1:${external.address().port}/`;
const freePort = async () => {
  const server = tcpServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
};
const portOpen = port => new Promise(resolve => {
  const socket = createConnection({ host: '127.0.0.1', port });
  const finish = value => { socket.destroy(); resolve(value); };
  socket.once('connect', () => finish(true)); socket.once('error', () => finish(false));
  socket.setTimeout(1000, () => finish(false));
});
const results = { version: JSON.parse(readFileSync('package.json', 'utf8')).version };
const errors = [];
let child, browser, stderr = '';
const env = { ...process.env, DAYBOOK_TEST: '1', DAYBOOK_DATA_DIR: data,
  VITE_DEV_SERVER_URL: externalUrl, ELECTRON_RUN_AS_NODE: '1', NODE_OPTIONS: `--require="${injected}"` };
async function stop() {
  if (browser) { await browser.close().catch(() => {}); browser = undefined; }
  if (child && child.exitCode === null && child.signalCode === null) {
    const exited = new Promise(resolve => child.once('exit', resolve));
    child.kill(); await exited;
  }
  child = undefined;
}
async function launch() {
  const cdp = await freePort(), inspector = await freePort();
  child = spawn(executable, ['--background', `--remote-debugging-port=${cdp}`, `--inspect=127.0.0.1:${inspector}`], { env, windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
  child.stderr.on('data', chunk => { stderr = (stderr + chunk).slice(-12000); });
  let launchError;
  child.once('error', error => { launchError = error; });
  await expect.poll(async () => {
    if (launchError) throw launchError;
    if (child.exitCode !== null) throw new Error(`Application exited: ${child.exitCode}\n${stderr}`);
    try { return (await fetch(`http://127.0.0.1:${cdp}/json/version`)).ok; } catch { return false; }
  }, { timeout: 20000 }).toBe(true);
  browser = await chromium.connectOverCDP(`http://127.0.0.1:${cdp}`);
  const context = browser.contexts()[0];
  await expect.poll(() => context.pages().length).toBeGreaterThan(0);
  const page = context.pages().find(page => !page.url().endsWith('#reminder'));
  page.setDefaultTimeout(10000);
  page.on('pageerror', error => errors.push(error.message));
  await page.locator('.workspace').waitFor();
  assert.equal(page.url(), 'daybook://app/index.html');
  assert.equal(await portOpen(inspector), false, 'Packaged Node inspector must be disabled');
  assert.equal(existsSync(marker), false, 'NODE_OPTIONS must not inject code');
  assert.equal(externalRequests, 0, 'Packaged app must ignore the development server');
  return page;
}
try {
  let page = await launch();
  assert.equal((await page.evaluate(() => window.daybook.snapshot())).items.length, 0);
  assert.deepEqual(await page.evaluate(() => ({ require: typeof window.require, process: typeof window.process })), { require: 'undefined', process: 'undefined' });
  results.environmentInjectionBlocked = true;
  const baseline = page.url();
  const denied = await page.evaluate(async () => {
    history.replaceState(null, '', '#unexpected');
    try { await window.daybook.snapshot(); return false; } catch { return true; }
    finally { history.replaceState(null, '', location.pathname); }
  });
  assert.equal(denied, true, 'IPC must reject the wrong document URL');
  assert.equal(page.url(), baseline);
  await assert.rejects(page.evaluate(() => window.daybook.save({ value: { title: 5 } })));
  assert.equal((await page.evaluate(() => window.daybook.snapshot())).items.length, 0);
  for (const url of [externalUrl, pathToFileURL(privateFile).href]) {
    assert.equal(await page.evaluate(async url => { try { await fetch(url); return false; } catch { return true; } }, url), true);
  }
  results.rendererBoundary = true;

  await page.evaluate(() => window.daybook.windowAction('full'));
  const fixture = await page.evaluate(async () => {
    const d = new Date(), date = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const title = '<img src=x onerror="window.injected=true">';
    const value = { title, notes: "'); DROP TABLE items; --", date, startAt: `${date}T15:00`, endAt: `${date}T16:00`, repeat: { kind: 'daily', weekdays: [], until: null }, reminders: [] };
    await window.daybook.save({ value });
    return { date, title, id: (await window.daybook.snapshot()).items[0].id };
  });
  await expect(page.locator('.row-title strong')).toHaveText(fixture.title);
  assert.equal(await page.locator('.row-title img').count(), 0);
  assert.equal(await page.evaluate(() => window.injected), undefined);
  await page.getByRole('checkbox', { name: `完成 ${fixture.title}`, exact: true }).click();
  assert.ok((await page.evaluate(() => window.daybook.snapshot())).states[0].completedAt);
  await page.getByRole('button', { name: `刪除 ${fixture.title}`, exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByTestId('agenda-row')).toHaveCount(0);
  const snapshot = await page.evaluate(() => window.daybook.snapshot());
  assert.equal(snapshot.items.length, 1);
  assert.ok(snapshot.exceptions.some(e => e.deleted && e.occurrenceDate === fixture.date));
  await page.getByRole('button', { name: '下一頁日期' }).click();
  await expect(page.locator('.row-title strong')).toHaveText(fixture.title);
  results.safeTextAndSingleDeletion = true;

  results.reminders = [];
  for (const mode of ['full', 'mini', 'close']) {
    await page.evaluate(mode => window.daybook.windowAction(mode), mode);
    const delivery = await page.evaluate(() => window.daybook.testNotification());
    assert.equal(delivery.display, 'shown'); assert.equal(delivery.audio, 'played');
    const card = browser.contexts()[0].pages().find(page => page.url().endsWith('#reminder'));
    assert.ok(card);
    await expect(card.getByRole('main', { name: '日序提醒' })).toBeVisible();
    assert.deepEqual(await card.evaluate(() => ({ daybook: typeof window.daybook, require: typeof window.require })), { daybook: 'undefined', require: 'undefined' });
    await card.getByRole('button', { name: '關閉提醒', exact: true }).click();
    results.reminders.push({ mode, ...delivery });
  }
  const second = spawn(executable, ['--background'], { env, windowsHide: true, stdio: 'ignore' });
  try {
    await expect.poll(() => second.exitCode, { timeout: 10000 }).toBe(0);
  } finally { if (second.exitCode === null) second.kill(); }
  results.singleInstance = true;
  // Last action before restarting: Electron-cancelled navigation can leave
  // Playwright's navigation waiter pending even though the document is intact.
  await page.evaluate(url => {
    const anchor = document.createElement('a'); anchor.href = url; document.body.append(anchor); anchor.click(); anchor.remove();
    window.open(url);
  }, externalUrl);
  assert.equal(page.url(), baseline);
  assert.equal(externalRequests, 0);
  assert.equal(browser.contexts()[0].pages().length, 1);
  assert.equal((await page.evaluate(() => window.daybook.snapshot())).items.length, 1);
  await stop();
  page = await launch();
  const restored = await page.evaluate(() => window.daybook.snapshot());
  assert.deepEqual(restored.items, snapshot.items);
  assert.deepEqual(restored.exceptions, snapshot.exceptions);
  assert.deepEqual(restored.states, snapshot.states);
  results.persistence = true;
  assert.equal(externalRequests, 0);
  assert.deepEqual(errors, []);
  results.audioLimit = 'Audio renderer completed playback; physical speaker audibility is not asserted.';
  console.log('PASS: hardened packaged app, blocked environment/URL injection, validated IPC, safe text, single-row delete, reminders in full/mini/tray, single instance, and restart persistence.');
} catch (error) {
  console.error(error); console.error(stderr); process.exitCode = 1; results.error = String(error);
} finally {
  await stop();
  await new Promise(resolve => external.close(resolve));
  writeFileSync('test-results/release-verification.json', JSON.stringify(results, null, 2));
}
