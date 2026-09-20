import { _electron as electron, expect } from '@playwright/test';
import { mkdirSync, mkdtempSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
mkdirSync('test-results', { recursive: true });
const env = { ...process.env, DAYBOOK_TEST: '1', DAYBOOK_DATA_DIR: mkdtempSync(resolve('test-results/delete-row-')) };
delete env.ELECTRON_RUN_AS_NODE;
const version = JSON.parse(readFileSync('package.json', 'utf8')).version;
let desktop;
try {
  desktop = await electron.launch({ ...(process.argv[2] ? { executablePath: process.argv[2], args: ['--background'] } : { args: [resolve('.')] }), env });
  const page = await desktop.firstWindow();
  await page.locator('.workspace').waitFor();
  await desktop.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].showInactive());
  const dates = await page.evaluate(async () => {
    const key = offset => { const d = new Date(); d.setDate(d.getDate() + offset); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
    const today = key(0), yesterday = key(-1), tomorrow = key(1);
    const value = { title: '一般事項', notes: '', date: today, startAt: `${today}T09:00`, endAt: `${today}T10:00`, reminders: [], repeat: { kind: 'none', weekdays: [], until: null } };
    await window.daybook.save({ value });
    await window.daybook.save({ value: { ...value, title: '臨時待辦', startAt: null, endAt: null } });
    for (const title of ['每天讀書', '每天散步']) await window.daybook.save({ value: { ...value, title, date: yesterday, startAt: `${yesterday}T11:00`, endAt: `${yesterday}T12:00`, repeat: { kind: 'daily', weekdays: [], until: key(3) } } });
    return { today, yesterday, tomorrow };
  });
  await expect(page.getByTestId('agenda-row')).toHaveCount(4);
  for (const width of [1180, 850]) {
    await desktop.evaluate(({ BrowserWindow }, width) => BrowserWindow.getAllWindows()[0].setBounds({ width, height: 820 }), width);
    const positions = await page.locator('.row-actions').evaluateAll(groups => groups.map(group => [...group.children].map(button => ({ label: button.getAttribute('aria-label'), opacity: getComputedStyle(button).opacity, x: button.getBoundingClientRect().x, y: button.getBoundingClientRect().y, right: button.getBoundingClientRect().right }))));
    for (const [edit, remove] of positions) { assert.match(edit.label, /^編輯 /); assert.match(remove.label, /^刪除 /); assert.equal(edit.opacity, '1'); assert.ok(edit.right <= remove.x); assert.equal(edit.y, remove.y); assert.ok(remove.right <= width); }
    await page.screenshot({ path: `test-results/${version}-actions-${width}.png` });
  }
  await page.getByRole('button', { name: '編輯 一般事項', exact: true }).click();
  await expect(page.getByRole('dialog', { name: '編輯事項' })).toBeVisible();
  await page.getByRole('button', { name: '取消', exact: true }).click();
  await page.getByRole('button', { name: '刪除 一般事項', exact: true }).click();
  await expect(page.getByRole('button', { name: '刪除 一般事項', exact: true })).toHaveCount(0);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: '刪除 臨時待辦', exact: true }).click();
  await expect(page.getByRole('button', { name: '刪除 臨時待辦', exact: true })).toHaveCount(0);
  assert.ok(!(await page.evaluate(() => window.daybook.snapshot())).items.some(i => ['一般事項', '臨時待辦'].includes(i.title)));
  await page.getByRole('button', { name: '刪除 每天讀書', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '刪除 每天讀書', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '下一頁日期' }).click();
  await expect(page.getByRole('button', { name: '刪除 每天讀書', exact: true })).toBeVisible();
  const before = await page.evaluate(() => window.daybook.snapshot());
  await page.getByRole('button', { name: '刪除 每天散步', exact: true }).click();
  await expect(page.getByRole('button', { name: '刪除 每天散步', exact: true })).toHaveCount(0);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const snapshot = await page.evaluate(() => window.daybook.snapshot());
  assert.deepEqual(snapshot.items, before.items);
  assert.ok(snapshot.exceptions.some(e => e.itemId === snapshot.items.find(i => i.title === '每天讀書').id && e.occurrenceDate === dates.today && e.deleted));
  assert.ok(snapshot.exceptions.some(e => e.itemId === snapshot.items.find(i => i.title === '每天散步').id && e.occurrenceDate === dates.tomorrow && e.deleted));
  await page.getByRole('button', { name: '下一頁日期' }).click();
  await expect(page.getByRole('button', { name: '刪除 每天散步', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '上一頁日期' }).click();
  await page.getByRole('button', { name: '上一頁日期' }).click();
  await expect(page.getByRole('button', { name: '刪除 每天散步', exact: true })).toBeVisible();
  // The editor's modification scope must never broaden a trash action to future dates.
  await page.getByRole('button', { name: '編輯 每天散步', exact: true }).click();
  await page.getByLabel('修改範圍', { exact: true }).selectOption('future');
  await page.getByRole('button', { name: '刪除事項', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '刪除 每天散步', exact: true })).toHaveCount(0);
  assert.deepEqual((await page.evaluate(() => window.daybook.snapshot())).items, before.items);
  // A rejected database operation must leave the item visible and allow retry.
  await page.evaluate(async today => window.daybook.save({ value: { title: '失敗時保留', notes: '', date: today, startAt: null, endAt: null, repeat: { kind: 'none', weekdays: [], until: null }, reminders: [] } }), dates.today);
  await desktop.evaluate(({ ipcMain }) => { ipcMain.removeHandler('remove'); ipcMain.handle('remove', () => { throw new Error('測試：無法寫入資料'); }); });
  await page.getByRole('button', { name: '刪除 失敗時保留', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('無法寫入資料');
  await expect(page.getByRole('button', { name: '刪除 失敗時保留', exact: true })).toBeEnabled();
  assert.ok((await page.evaluate(() => window.daybook.snapshot())).items.some(i => i.title === '失敗時保留'));
  console.log('PASS: direct single-row deletion without dialogs; other recurring dates preserved; editor scope cannot broaden deletion; failure preserves data.');
} finally { if (desktop) { const proc = desktop.process(); await Promise.race([desktop.close().catch(() => {}), new Promise(r => setTimeout(r, 4000))]); proc.kill(); } }
