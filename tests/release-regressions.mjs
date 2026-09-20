import { _electron as electron, expect } from '@playwright/test';
import { mkdirSync, mkdtempSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { locales } from '../dist-electron/src/shared/appearance.js';

mkdirSync('test-results', { recursive: true });
const env = { ...process.env, DAYBOOK_TEST: '1', DAYBOOK_DATA_DIR: mkdtempSync(resolve('test-results/release-regressions-')), DAYBOOK_TEST_LOCALE: 'en-US', DAYBOOK_TEST_THEME: 'dark' };
delete env.ELECTRON_RUN_AS_NODE; delete env.VITE_DEV_SERVER_URL;
let app;
try {
  app = await electron.launch({ args: [resolve('.')], env });
  const page = await app.firstWindow();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    // Chromium checks FullCalendar's unused @font-face declaration against CSP.
    // Keep blocking that data URL; the close control below must use CSS, not this font.
    const blockedUnusedFont = message.text().startsWith("Loading the font 'data:application/x-font-ttf;") && message.text().includes("font-src 'self'");
    if (message.type() === 'error' && !blockedUnusedFont) errors.push(message.text());
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.locator('.workspace').waitFor();
  await page.evaluate(() => window.daybook.windowAction('full'));

  // An invalid timed reminder must not block a to-do whose reminder fields are hidden.
  await page.getByRole('button', { name: 'Add item', exact: true }).click();
  await page.getByRole('combobox', { name: 'Item name', exact: true }).fill('Unscheduled task');
  await page.locator('.reminder-line').first().locator('select').nth(1).selectOption('custom');
  await page.locator('.custom-offset input').fill('');
  await page.getByRole('button', { name: 'Save as to-do', exact: true }).click();
  await expect(page.locator('.reminder-editor')).toHaveCount(0);
  // Switching back preserves the timed draft, without corrupting it or discarding input.
  await page.locator('.form-segment button').first().click();
  await expect(page.locator('.custom-offset input')).toHaveValue('');
  await page.getByRole('button', { name: 'Save as to-do', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Add item', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const saved = (await page.evaluate(() => window.daybook.snapshot())).items[0];
  assert.equal(saved.title, 'Unscheduled task');
  assert.equal(saved.startAt, null); assert.deepEqual(saved.reminders, []);

  // Duplicate narrow weekday names (S/T in English) must never become React keys.
  await page.getByRole('button', { name: 'Add item', exact: true }).click();
  await page.locator('#repeat-kind').selectOption('weekly');
  const weekdays = page.locator('.weekday-picker > button');
  for (let i = 0; i < 7; i++) if (await weekdays.nth(i).getAttribute('aria-pressed') === 'true') await weekdays.nth(i).click();
  await weekdays.nth(0).click(); await weekdays.nth(4).click();
  for (const locale of [...locales, 'en-US']) {
    await page.evaluate(locale => window.daybook.saveAppearance({ locale }), locale);
    await expect(page.locator('html')).toHaveAttribute('lang', locale);
    await expect(weekdays).toHaveCount(7);
    const labels = await weekdays.evaluateAll(els => els.map(el => el.getAttribute('aria-label')));
    assert.equal(new Set(labels).size, 7, locale);
    assert.deepEqual(await weekdays.evaluateAll(els => els.map((el, i) => el.getAttribute('aria-pressed') === 'true' ? i : -1).filter(i => i >= 0)), [0, 4]);
  }
  await page.keyboard.press('Escape');

  // No data-URL icon font is needed; keep CSP strict while rendering an accessible close control.
  await page.evaluate(async () => {
    const d = new Date(), date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    for (let i = 1; i <= 5; i++) await window.daybook.save({ value: { title: 'Popover item ' + i, notes: '', date, startAt: `${date}T13:00`, endAt: `${date}T14:00`, reminders: [], repeat: { kind: 'none', weekdays: [], until: null } } });
  });
  await page.getByRole('button', { name: 'Month', exact: true }).click();
  for (const theme of ['light', 'dark']) {
    await page.evaluate(theme => window.daybook.saveAppearance({ theme }), theme);
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    await page.locator('.fc-daygrid-more-link').first().click();
    const close = page.locator('.fc-popover-close');
    await expect(close).toBeVisible();
    await expect(page.locator('.fc-popover')).toContainText('Popover item 1 · Overlap');
    const style = await close.evaluate(el => ({ font: getComputedStyle(el).fontFamily, before: getComputedStyle(el, '::before').content, width: getComputedStyle(el, '::before').width, label: el.getAttribute('title') || el.getAttribute('aria-label') }));
    assert.doesNotMatch(style.font, /fcicons/); assert.equal(style.before, '""'); assert.equal(style.width, '16px'); assert.ok(style.label);
    await page.screenshot({ path: `test-results/release-regressions-popover-${theme}.png` });
    await close.focus(); await page.keyboard.press('Enter');
    await expect(page.locator('.fc-popover')).toHaveCount(0);
  }
  assert.deepEqual(errors, []);
  console.log('PASS: hidden reminder validation, preserved drafts, 14-locale weekday identity, light/dark calendar close icons, keyboard and CSP.');
} finally {
  if (app) { const proc = app.process(); await Promise.race([app.close().catch(() => {}), new Promise(r => setTimeout(r, 4000))]); proc.kill(); }
}
