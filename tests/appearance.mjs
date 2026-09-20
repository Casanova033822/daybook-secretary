import { _electron as electron, expect } from '@playwright/test';
import { mkdirSync, mkdtempSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { languages } from '../dist-electron/src/shared/appearance.js';
import { translate } from '../dist-electron/src/shared/i18n.js';
mkdirSync('test-results', { recursive: true });
const dataDir = mkdtempSync(resolve('test-results/appearance-'));
const env = { ...process.env, DAYBOOK_TEST: '1', DAYBOOK_DATA_DIR: dataDir, DAYBOOK_TEST_LOCALE: 'zh-TW', DAYBOOK_TEST_THEME: 'light' };
delete env.ELECTRON_RUN_AS_NODE; delete env.VITE_DEV_SERVER_URL;
let desktop, page;
const errors = [], outbound = [];
async function launch() {
  desktop = await electron.launch({ args: [resolve('.')], env });
  page = await desktop.firstWindow();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (/^https?:/.test(request.url())) outbound.push(request.url()); });
  await page.locator('.workspace').waitFor();
  await page.evaluate(() => window.daybook.windowAction('full'));
}
async function choose(locale) {
  await page.locator('.language-picker > button').click();
  await page.locator(`[data-locale="${locale}"]`).click();
  await expect(page.locator('html')).toHaveAttribute('lang', locale);
}
async function close() {
  if (!desktop) return;
  const proc = desktop.process();
  await Promise.race([desktop.close().catch(() => {}), new Promise(r => setTimeout(r, 4000))]);
  proc.kill(); desktop = undefined;
}
try {
  await launch();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.getByTestId('theme-toggle').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.screenshot({ path: 'test-results/appearance-dark-day.png' });
  await page.getByRole('button', { name: '偏好設定', exact: true }).click();
  const generalSwitch = page.getByRole('dialog').getByRole('switch').first();
  await generalSwitch.uncheck();
  for (const language of languages) {
    await choose(language.locale);
    await expect(page.getByRole('dialog')).toHaveAttribute('aria-label', translate(language.locale, '讓日序更適合你'));
    await expect(page.locator('html')).toHaveAttribute('dir', language.locale === 'ar' ? 'rtl' : 'ltr');
    const flag = page.locator('.language-picker > button img');
    assert.equal(await flag.evaluate(img => img.complete && img.naturalWidth > 0), true, language.locale);
    await expect(generalSwitch).not.toBeChecked();
    await expect(page.locator('.mini-calendar-grid .weekday')).toHaveCount(7);
    // The open settings draft must not overwrite an immediate theme or language change.
    for (const theme of ['light', 'dark']) {
      await page.evaluate(theme => window.daybook.saveAppearance({ theme }), theme);
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    }
    if (['de', 'ar', 'ja', 'hi'].includes(language.locale)) await page.screenshot({ path: `test-results/appearance-${language.locale}-settings.png` });
  }
  await page.getByRole('button', { name: translate('id', '儲存設定'), exact: true }).click();
  await expect(page.getByRole('status')).toHaveText(translate('id', '設定已儲存。'));
  let snapshot = await page.evaluate(() => window.daybook.snapshot());
  assert.equal(snapshot.settings.locale, 'id'); assert.equal(snapshot.settings.theme, 'dark'); assert.equal(snapshot.settings.launchOnLogin, false);
  await choose('en-US');
  await expect(page.getByRole('status')).toHaveText('Settings saved.');
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: 'Add item', exact: true }).click();
  await page.getByRole('combobox', { name: 'Item name', exact: true }).fill('使用者內容 stays unchanged');
  await page.getByRole('combobox', { name: 'Start hour', exact: true }).fill('13');
  await page.getByRole('combobox', { name: 'Start minute', exact: true }).fill('00');
  await page.getByRole('combobox', { name: 'Duration in minutes', exact: true }).fill('60');
  await page.screenshot({ path: 'test-results/appearance-en-editor.png' });
  await page.getByRole('dialog').getByRole('button', { name: 'Add item', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  for (const name of ['Week', 'Month']) {
    await page.getByRole('button', { name, exact: true }).click();
    await page.screenshot({ path: `test-results/appearance-en-${name}.png` });
  }
  await page.getByRole('button', { name: 'Day', exact: true }).click();
  await page.getByRole('button', { name: 'Preferences', exact: true }).click();
  // The displayed card must update without resetting its audio or close timer.
  await page.evaluate(() => window.daybook.testNotification());
  const card = desktop.windows().find(p => p.url().endsWith('#reminder'));
  assert.ok(card);
  await card.emulateMedia({ reducedMotion: 'reduce' });
  await expect(card.locator('html')).toHaveAttribute('data-theme', 'dark');
  await choose('ar');
  await expect(card.locator('html')).toHaveAttribute('lang', 'ar');
  await expect(card.locator('main')).toHaveAttribute('aria-label', translate('ar', '日序提醒'));
  await page.evaluate(() => window.daybook.saveAppearance({ theme: 'light' }));
  await expect(card.locator('html')).toHaveAttribute('data-theme', 'light');
  await card.screenshot({ path: 'test-results/appearance-ar-reminder.png' });
  await page.getByRole('button', { name: translate('ar', '關閉'), exact: true }).click();
  await page.getByRole('button', { name: translate('ar', '迷你視窗'), exact: true }).click();
  await page.screenshot({ path: 'test-results/appearance-ar-mini.png' });
  await page.getByTestId('theme-toggle').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await close(); await launch();
  await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  snapshot = await page.evaluate(() => window.daybook.snapshot());
  assert.equal(snapshot.items[0].title, '使用者內容 stays unchanged');
  await desktop.evaluate(({ ipcMain }) => { ipcMain.removeHandler('appearance-save'); ipcMain.handle('appearance-save', () => { throw new Error('設定格式不正確。'); }); });
  await page.getByTestId('theme-toggle').click();
  await expect(page.locator('.appearance-error')).toHaveText(translate('ar', '設定格式不正確。'));
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: translate('ar', '偏好設定'), exact: true }).click();
  await page.locator('.language-picker > button').click(); await page.locator('[data-locale="en-US"]').click();
  await expect(page.locator('.language-setting [role="alert"]')).toHaveText(translate('ar', '設定格式不正確。'));
  await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
  assert.deepEqual(errors, []); assert.deepEqual(outbound, []);
  console.log('PASS: all 14 locales, flags, themes, unsaved drafts, reminder sync, RTL, persistence, failure rollback and offline loading.');
} finally { await close(); }
