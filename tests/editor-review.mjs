import { _electron as electron, expect } from '@playwright/test';
import { mkdirSync, mkdtempSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
mkdirSync('test-results', { recursive: true });
const env = { ...process.env, DAYBOOK_TEST: '1', DAYBOOK_DATA_DIR: mkdtempSync(resolve('test-results/editor-review-')) };
delete env.ELECTRON_RUN_AS_NODE;
let desktop;
try {
  desktop = await electron.launch({ args: [resolve('.')], env });
  const page = await desktop.firstWindow();
  await page.locator('.workspace').waitFor();
  await page.evaluate(() => window.daybook.windowAction('full'));
  const fixture = await page.evaluate(async () => {
    const d = new Date(), date = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    for (const title of ['Review A', 'Review B']) await window.daybook.save({ value: { title, notes: `${title} note`, date, startAt: `${date}T15:00`, endAt: `${date}T16:00`, repeat: { kind: 'none', weekdays: [], until: null }, reminders: [] } });
    const items = (await window.daybook.snapshot()).items;
    return { date, a: items.find(i => i.title === 'Review A').id, b: items.find(i => i.title === 'Review B').id };
  });
  await page.getByRole('button', { name: '編輯 Review A', exact: true }).click();
  await page.getByRole('combobox', { name: '事項名稱', exact: true }).fill('Unsaved A draft');
  // Same main-process event as clicking a reminder for a different occurrence.
  await desktop.evaluate(({ BrowserWindow }, fixture) => BrowserWindow.getAllWindows()[0].webContents.send('app-event', { type: 'open', date: fixture.date, target: { itemId: fixture.b, occurrenceDate: fixture.date } }), fixture);
  await expect(page.getByRole('combobox', { name: '事項名稱', exact: true })).toHaveValue('Review B');
  await expect(page.getByLabel('備註', { exact: false })).toHaveValue('Review B note');
  await page.getByRole('button', { name: '儲存變更', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const snapshot = await page.evaluate(() => window.daybook.snapshot());
  assert.equal(snapshot.items.find(i => i.id === fixture.a).title, 'Review A');
  assert.equal(snapshot.items.find(i => i.id === fixture.b).title, 'Review B');
  await page.getByRole('button', { name: '編輯 Review B', exact: true }).click();
  await page.getByRole('button', { name: '加入提醒', exact: true }).click();
  await page.getByLabel('提醒 1 時機', { exact: true }).selectOption('custom');
  const custom = page.getByLabel('提醒 1 提前分鐘', { exact: true });
  await custom.fill('');
  await custom.pressSequentially('100');
  await expect(custom).toHaveValue('100');
  await page.getByRole('button', { name: '加入提醒', exact: true }).click();
  await page.getByLabel('提醒 2 時機', { exact: true }).selectOption('custom');
  const secondCustom = page.getByLabel('提醒 2 提前分鐘', { exact: true });
  await secondCustom.fill(''); await secondCustom.pressSequentially('10');
  await page.getByRole('button', { name: '移除提醒 1', exact: true }).click();
  await expect(custom).toHaveValue('10');
  await custom.fill('100');
  await page.getByRole('button', { name: '儲存變更', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const saved = await page.evaluate(() => window.daybook.snapshot());
  assert.equal(saved.items.find(i => i.id === fixture.b).reminders[0].minutes, 100);
  await desktop.evaluate(({ ipcMain }) => {
    ipcMain.removeHandler('save');
    ipcMain.handle('save', () => new Promise(resolve => { globalThis.finishReviewSave = resolve; }));
  });
  await page.getByRole('button', { name: '編輯 Review A', exact: true }).click();
  await page.getByRole('button', { name: '儲存變更', exact: true }).click();
  await expect(page.getByRole('button', { name: '儲存中…', exact: true })).toBeDisabled();
  await desktop.evaluate(({ BrowserWindow }, fixture) => BrowserWindow.getAllWindows()[0].webContents.send('app-event', { type: 'open', date: fixture.date, target: { itemId: fixture.b, occurrenceDate: fixture.date } }), fixture);
  await page.getByRole('combobox', { name: '事項名稱', exact: true }).fill('Keep B draft');
  await desktop.evaluate(() => globalThis.finishReviewSave());
  await page.evaluate(() => window.daybook.snapshot());
  await page.waitForTimeout(250);
  await expect(page.getByRole('combobox', { name: '事項名稱', exact: true })).toHaveValue('Keep B draft');
  console.log('PASS: opening another occurrence cannot reuse and save the previous editor draft.');
  console.log('PASS: typing custom minutes through preset values keeps the input editable.');
  console.log('PASS: completion of an earlier save does not dismiss the newly opened editor.');
} finally {
  if (desktop) { const proc = desktop.process(); await Promise.race([desktop.close().catch(() => {}), new Promise(resolve => setTimeout(resolve, 4000))]); proc.kill(); }
}
