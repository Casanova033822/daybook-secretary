import { _electron as electron, expect } from '@playwright/test';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
const executablePath = process.argv[2] ?? join(process.env.LOCALAPPDATA, 'Programs', 'daybook-secretary', '日序.exe');
mkdirSync('test-results', { recursive: true });
const dataDir = mkdtempSync(resolve('test-results/windows-'));
const env = { ...process.env, DAYBOOK_TEST: '1', DAYBOOK_DATA_DIR: dataDir, DAYBOOK_LIVE_NOTIFICATIONS: '1' };
delete env.ELECTRON_RUN_AS_NODE;
const results = {};
const version = JSON.parse(readFileSync('package.json', 'utf8')).version;
let desktop;
try {
  desktop = await electron.launch({ executablePath, args: ['--background'], env });
  const page = await desktop.firstWindow();
  await page.getByRole('heading', { name: '今天，照自己的步調。' }).waitFor();
  results.packaged = await desktop.evaluate(({ app }) => app.isPackaged);
  assert.equal(results.packaged, true);
  results.backgroundHidden = await desktop.evaluate(({ BrowserWindow }) => !BrowserWindow.getAllWindows()[0].isVisible());
  assert.equal(results.backgroundHidden, true);

  // Exercise the OS registration without changing the user's real login preference.
  results.loginRegistration = await desktop.evaluate(({ app }) => {
    const path = process.execPath, args = ['--background', '--verification'];
    app.setAppUserModelId('tw.daybook.secretary.verification');
    app.setLoginItemSettings({ openAtLogin: true, path, args });
    try { return app.getLoginItemSettings({ path, args }); }
    finally { app.setLoginItemSettings({ openAtLogin: false, path, args }); app.setAppUserModelId('tw.daybook.secretary'); }
  });
  assert.equal(results.loginRegistration.openAtLogin, true);

  results.version = await desktop.evaluate(({ app }) => app.getVersion());
  assert.equal(results.version, version);
  results.reminder = await page.evaluate(() => window.daybook.testNotification());
  assert.equal(results.reminder.display, 'shown');
  assert.equal(results.reminder.audio, 'played');
  const card = desktop.windows().find(p => p.url().endsWith('#reminder'));
  await expect(card.getByRole('main', { name: '日序提醒' })).toBeVisible();
  await card.screenshot({ path: `test-results/${version}-installed-reminder.png` });
  await card.getByRole('button', { name: '查看行程' }).click();
  assert.equal(await desktop.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isVisible()), true);
  results.notificationClick = true;

  // Test login-style second launch: no second process or duplicate window remains.
  const second = spawn(executablePath, ['--background'], { env, windowsHide: true, stdio: 'ignore' });
  const secondExit = await Promise.race([new Promise(r => second.on('exit', code => r(code))), new Promise((_, reject) => setTimeout(() => { second.kill(); reject(new Error('Second instance did not exit')); }, 10000))]);
  assert.equal(secondExit, 0);
  assert.equal(await desktop.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length), 1);
  results.singleInstance = true;

  // Seed a missed reminder only in the isolated QA database, then emit a real Electron resume event.
  await desktop.evaluate(async ({ app, powerMonitor }) => {
    const { DatabaseSync } = process.getBuiltinModule('node:sqlite');
    const { join } = process.getBuiltinModule('node:path');
    const db = new DatabaseSync(join(app.getPath('userData'), 'daybook.sqlite'));
    const local = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}T${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
    const now = Date.now(), a = local(new Date(now - 60000)), b = local(new Date(now + 60000));
    const item = { id: 'resume-check', title: '日序喚醒提醒測試', notes: '', date: a.slice(0,10), startAt: a, endAt: b, repeat: {kind:'none',weekdays:[],until:null}, reminders: [{anchor:'start',minutes:0}], createdAt: now - 3600000, updatedAt: now - 3600000 };
    db.prepare('INSERT INTO items(id,value) VALUES(?,?)').run(item.id, JSON.stringify(item));
    db.close();
    powerMonitor.emit('resume');
  });
  await expect.poll(() => desktop.windows().some(p => p.url().endsWith('#reminder')), { timeout: 10000 }).toBe(true);
  const resumed = desktop.windows().find(p => p.url().endsWith('#reminder'));
  await expect(resumed.getByText('今天錯過的提醒', { exact: true })).toBeVisible();
  await expect(resumed.getByText('日序喚醒提醒測試', { exact: true })).toBeVisible();
  results.resumeCallback = true;
  await resumed.getByRole('button', { name: '關閉提醒' }).click();
  results.audio = 'Bundled audio completed in the independent renderer; physical speaker audibility requires user confirmation.';
  results.physicalResume = 'Electron resume event simulated; physical sleep and Windows login were not triggered.';
  console.log(`PASS: installed ${version}, real reminder window and audio completion, click opens app, login registration, single instance, background launch, resume catch-up.`);
} catch (error) { console.error(error); process.exitCode = 1; results.error = String(error); }
finally {
  writeFileSync('test-results/windows-verification.json', JSON.stringify(results, null, 2));
  if (desktop) { const proc = desktop.process(); await Promise.race([desktop.close().catch(() => {}), new Promise(r => setTimeout(r, 4000))]); proc.kill(); }
}
