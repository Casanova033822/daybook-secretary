import { _electron as electron, expect } from '@playwright/test';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import assert from 'node:assert/strict';
mkdirSync('test-results', { recursive: true });
const dataDir = mkdtempSync(resolve('test-results/reminders-'));
const env = { ...process.env, DAYBOOK_TEST: '1', DAYBOOK_DATA_DIR: dataDir };
delete env.ELECTRON_RUN_AS_NODE;
const results = { dataDir, phases: [] };
let desktop, main;
const launch = async () => {
  desktop = await electron.launch({ ...(process.argv[2] ? { executablePath: process.argv[2], args: ['--background'] } : { args: [resolve('.')] }), env });
  main = await desktop.firstWindow();
  await main.locator('.workspace').waitFor();
  await desktop.evaluate(({ BrowserWindow }) => {
    globalThis.cardFocusChecks = [];
    const original = BrowserWindow.prototype.showInactive;
    BrowserWindow.prototype.showInactive = function (...args) {
      if (!this.webContents.getURL().endsWith('#reminder')) return original.apply(this, args);
      const before = BrowserWindow.getFocusedWindow()?.id ?? null;
      const result = original.apply(this, args);
      globalThis.cardFocusChecks.push({ before, after: BrowserWindow.getFocusedWindow()?.id ?? null });
      return result;
    };
  });
};
const audit = () => desktop.evaluate(({ app }) => {
  const { DatabaseSync } = process.getBuiltinModule('node:sqlite');
  const db = new DatabaseSync(process.getBuiltinModule('node:path').join(app.getPath('userData'), 'daybook.sqlite'), { readOnly: true });
  try { return JSON.parse(db.prepare("SELECT value FROM meta WHERE key='test-notifications'").get()?.value ?? '[]'); } finally { db.close(); }
});
const waitCard = async (timeout = 70000) => {
  await expect.poll(() => desktop.windows().some(p => p.url().endsWith('#reminder')), { timeout }).toBe(true);
  const card = desktop.windows().find(p => p.url().endsWith('#reminder'));
  await card.getByRole('main', { name: '日序提醒' }).waitFor();
  return card;
};
const close = async () => { const proc = desktop.process(); await Promise.race([desktop.close().catch(() => {}), new Promise(r => setTimeout(r, 4000))]); proc.kill(); };
try {
  await launch();
  for (const mode of ['full', 'mini', 'hidden']) {
    const priorDeliveries = (await audit()).length;
    await main.evaluate(mode => window.daybook.windowAction(mode === 'hidden' ? 'close' : mode), mode);
    const scheduled = await main.evaluate(async mode => {
      const stamp = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      const at = Math.floor(Date.now() / 60000) * 60000 + 60000;
      const startAt = stamp(new Date(at)), date = startAt.slice(0, 10);
      const value = { title: `實際排程提醒 · ${mode}`, date, startAt, endAt: stamp(new Date(at + 600000)), notes: '', repeat: { kind: 'none', weekdays: [], until: null }, reminders: [{ anchor: 'start', minutes: 0 }] };
      await window.daybook.save({ value });
      if (mode === 'full') {
        await window.daybook.save({ value: { ...value, title: '同時提醒的第二件事' } });
        await window.daybook.save({ value: { ...value, title: '提早完成不提醒' } });
        await window.daybook.save({ value: { ...value, title: '改期不提醒' } });
        const snapshot = await window.daybook.snapshot();
        await window.daybook.complete({ itemId: snapshot.items.find(i => i.title === '提早完成不提醒').id, occurrenceDate: date, completed: true });
        await window.daybook.save({ target: { itemId: snapshot.items.find(i => i.title === '改期不提醒').id, occurrenceDate: date, scope: 'single' }, value: { ...value, title: '改期不提醒', startAt: stamp(new Date(at + 3600000)), endAt: stamp(new Date(at + 4200000)) } });
      }
      return { at, title: value.title };
    }, mode);
    console.log(`Waiting for real ${mode} schedule at ${new Date(scheduled.at).toLocaleTimeString()}`);
    const card = await waitCard();
    await expect(card.getByText(scheduled.title, { exact: true })).toBeVisible();
    const state = await desktop.evaluate(({ BrowserWindow, screen }) => {
      const card = BrowserWindow.getAllWindows().find(w => w.webContents.getURL().endsWith('#reminder'));
      return { visible: card.isVisible(), focusable: card.isFocusable(), focused: card.isFocused(), focusCheck: globalThis.cardFocusChecks.at(-1), bounds: card.getBounds(), area: screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea };
    });
    assert.equal(state.visible, true); assert.equal(state.focusable, false); assert.equal(state.focused, false); assert.equal(state.focusCheck.after, state.focusCheck.before);
    assert.equal(state.bounds.x + state.bounds.width, state.area.x + state.area.width - 12);
    assert.equal(state.bounds.y + state.bounds.height, state.area.y + state.area.height - 12);
    await expect(card.locator('.reminder-card-item')).toHaveCount(mode === 'full' ? 2 : 1);
    await expect.poll(async () => (await audit()).length).toBe(priorDeliveries + 1);
    await expect.poll(async () => (await audit()).at(-1)?.audio).toBe('played');
    const entry = (await audit()).at(-1);
    assert.equal(entry.display, 'shown'); assert.equal(entry.missed, false);
    await card.screenshot({ path: `test-results/1.0.1-reminder-${mode}.png` });
    if (mode === 'full') {
      await card.getByRole('button', { name: new RegExp(scheduled.title) }).click();
      await expect(main.getByRole('dialog')).toBeVisible();
      await expect(main.getByRole('combobox', { name: '事項名稱', exact: true })).toHaveValue(scheduled.title);
      await main.getByRole('button', { name: '取消', exact: true }).click();
    } else {
      await expect.poll(() => desktop.windows().includes(card), { timeout: 12000 }).toBe(false);
    }
    results.phases.push({ mode, scheduled, state, delivery: entry });
    console.log(`PASS ${mode}: real schedule, ${entry.count} item(s), no focus change, audio ended, ${mode === 'full' ? 'click opens event' : 'auto dismiss'}`);
  }
  // A real failed showInactive call must retry, and resume must combine today's missed items.
  await desktop.evaluate(({ BrowserWindow, app, powerMonitor }) => {
    const original = BrowserWindow.prototype.showInactive;
    let failed = false;
    BrowserWindow.prototype.showInactive = function (...args) {
      if (this.webContents.getURL().endsWith('#reminder') && !failed) { failed = true; throw new Error('Injected one-time display failure'); }
      return original.apply(this, args);
    };
    const { DatabaseSync } = process.getBuiltinModule('node:sqlite');
    const db = new DatabaseSync(process.getBuiltinModule('node:path').join(app.getPath('userData'), 'daybook.sqlite'));
    const stamp = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}T${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
    const now = Date.now();
    for (let i = 0; i < 3; i++) {
      const at = now - (i === 2 ? 86400000 : 60000), startAt = stamp(new Date(at));
      const item = { id: `missed-${i}`, title: `喚醒補提醒 ${i}`, notes: '', date: startAt.slice(0,10), startAt, endAt: stamp(new Date(at + 600000)), repeat: {kind:'none',weekdays:[],until:null}, reminders:[{anchor:'start',minutes:0}], createdAt:at-3600000, updatedAt:at-3600000 };
      db.prepare('INSERT INTO items(id,value) VALUES(?,?)').run(item.id, JSON.stringify(item));
    }
    db.close(); powerMonitor.emit('resume');
  });
  await expect.poll(async () => (await audit()).filter(a => a.display === 'failed').length, { timeout: 15000 }).toBe(1);
  await expect.poll(async () => (await audit()).filter(a => a.display === 'shown' && a.missed).length, { timeout: 15000 }).toBe(1);
  const resumed = await waitCard(10000);
  await expect(resumed.locator('.reminder-card-item')).toHaveCount(2);
  await resumed.getByRole('button', { name: '關閉提醒' }).click();
  results.resumeAndRetry = await audit();
  const count = results.resumeAndRetry.length;
  await close(); await launch();
  await main.waitForTimeout(3000);
  assert.equal((await audit()).length, count);
  results.restartDeduplication = true;
  // A minimized main window must not suppress the independent card/audio renderer.
  await main.evaluate(async () => { await window.daybook.windowAction('full'); await window.daybook.windowAction('minimize'); });
  assert.equal(await desktop.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isMinimized()), true);
  const minimized = await main.evaluate(() => window.daybook.testNotification());
  assert.equal(minimized.display, 'shown'); assert.equal(minimized.audio, 'played');
  const minimizedCard = await waitCard(10000);
  await minimizedCard.getByRole('button', { name: '關閉提醒' }).click();
  results.minimized = minimized;
  // Force a real renderer audio rejection: display still succeeds and reports audio separately.
  await desktop.context().addInitScript(() => { if (location.hash === '#reminder') HTMLMediaElement.prototype.play = () => Promise.reject(new Error('Injected audio device failure')); });
  const audioFailure = await main.evaluate(() => window.daybook.testNotification());
  assert.equal(audioFailure.display, 'shown'); assert.equal(audioFailure.audio, 'failed');
  const failedAudioCard = await waitCard(10000);
  await failedAudioCard.getByRole('button', { name: '關閉提醒' }).click();
  results.audioFailure = audioFailure;
  results.audioEvidence = 'Each audio element reached ended; physical speaker audibility still requires user confirmation.';
  console.log('PASS: merged resume, yesterday excluded, actual show failure retry, restart deduplication.');
} catch (error) { console.error(error); results.error = String(error); process.exitCode = 1; }
finally { writeFileSync('test-results/reminder-verification.json', JSON.stringify(results, null, 2)); if (desktop) await close(); }
