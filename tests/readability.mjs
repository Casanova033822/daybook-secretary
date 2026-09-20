import { _electron as electron, expect } from '@playwright/test';
import { mkdirSync, mkdtempSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { translate } from '../dist-electron/src/shared/i18n.js';

mkdirSync('test-results', { recursive: true });
const env = { ...process.env, DAYBOOK_TEST: '1', DAYBOOK_DATA_DIR: mkdtempSync(resolve('test-results/readability-')), DAYBOOK_TEST_LOCALE: 'en-US', DAYBOOK_TEST_THEME: 'light' };
delete env.ELECTRON_RUN_AS_NODE; delete env.VITE_DEV_SERVER_URL;
let desktop;
try {
  desktop = await electron.launch({ args: [resolve('.')], env });
  const page = await desktop.firstWindow();
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.locator('.workspace').waitFor();
  await page.evaluate(async () => {
    const d = new Date(), date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    await window.daybook.save({ value: { title: 'Focus time — prepare the next project', notes: 'Review ideas and write down the next steps.', date, startAt: `${date}T13:00`, endAt: `${date}T15:00`, repeat: { kind: 'none', weekdays: [], until: null }, reminders: [{ anchor: 'start', minutes: 10 }] } });
  });
  const toggle = page.getByTestId('theme-toggle');
  await expect(page.locator('.window-buttons .theme-toggle')).toHaveCount(0);
  await expect(toggle).toHaveAttribute('role', 'switch');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  await toggle.press('ArrowLeft');
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  await toggle.press('ArrowRight');
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  await toggle.press('Space');
  await expect(toggle).toHaveAttribute('aria-checked', 'false');

  async function readable(selector, minimum = 14) {
    const sizes = await page.locator(selector).evaluateAll(els => els.map(el => ({ text: el.textContent, size: parseFloat(getComputedStyle(el).fontSize) })));
    assert.ok(sizes.length, selector);
    for (const { text, size } of sizes) assert.ok(size >= minimum, `${selector}: ${text} is ${size}px`);
  }
  async function aboveAdd() {
    const a = await toggle.boundingBox(), b = await page.locator('.add-button').boundingBox();
    assert.ok(a && b && a.y + a.height <= b.y, 'Theme switch is above Add item');
    assert.ok(Math.abs(a.x - b.x) < 1 && Math.abs(a.width - b.width) < 1);
  }
  for (const width of [1180, 850]) {
    await desktop.evaluate(({ BrowserWindow }, width) => BrowserWindow.getAllWindows()[0].setBounds({ width, height: 820 }), width);
    for (const locale of ['en-US', 'zh-TW', 'de', 'ar']) {
      for (const theme of ['light', 'dark']) {
        await page.evaluate(patch => window.daybook.saveAppearance(patch), { locale, theme });
        await expect(page.locator('html')).toHaveAttribute('lang', locale);
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
        await aboveAdd();
        assert.equal(await page.locator('.workspace').evaluate(el => el.scrollWidth > el.clientWidth), false);
        assert.equal(await page.locator('.sidebar').evaluate(el => el.scrollWidth > el.clientWidth), false, `${locale}/${width} sidebar overflow`);
        await readable('.row-title strong', 16);
        await readable('.row-note, .reminder-tag, .page-header p, .summary-card > div > span');
        if (width === 850 && locale === 'en-US') await page.screenshot({ path: `test-results/readability-en-${theme}-day.png` });
        await page.getByRole('button', { name: translate(locale, '偏好設定'), exact: true }).click();
        await readable('.setting-row small, .notification-test p, .privacy-note, .field-hint');
        await readable('.setting-row strong, .settings-section h3', 16);
        const contrast = await page.locator('.setting-row small').first().evaluate(el => {
          const rgb = value => value.match(/[\d.]+/g).slice(0, 3).map(Number).map(v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; });
          const luminance = value => { const [r, g, b] = rgb(value); return .2126 * r + .7152 * g + .0722 * b; };
          const fg = luminance(getComputedStyle(el).color), bg = luminance(getComputedStyle(el.closest('.modal')).backgroundColor);
          return (Math.max(fg, bg) + .05) / (Math.min(fg, bg) + .05);
        });
        assert.ok(contrast >= 4.5, `${locale}/${theme} secondary contrast ${contrast}`);
        assert.equal(await page.locator('.modal-body').evaluate(el => el.scrollWidth > el.clientWidth), false);
        await expect(page.getByRole('button', { name: translate(locale, '儲存設定'), exact: true })).toBeInViewport();
        if (width === 850) await page.screenshot({ path: `test-results/readability-${locale}-${theme}-settings.png` });
        await page.getByRole('button', { name: translate(locale, '關閉'), exact: true }).click();
      }
    }
  }
  await page.evaluate(() => window.daybook.saveAppearance({ locale: 'en-US' }));
  await expect(page.locator('html')).toHaveAttribute('lang', 'en-US');
  await page.getByRole('button', { name: 'Add item', exact: true }).click();
  await readable('.field-hint, .duration-row, .reminder-line select');
  await page.screenshot({ path: 'test-results/readability-en-editor.png' });
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Mini window', exact: true }).click();
  await expect(page.locator('.app')).toHaveClass(/mini-mode/);
  await aboveAdd();
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  await page.screenshot({ path: 'test-results/readability-en-mini.png' });
  assert.equal(await page.locator('.workspace').evaluate(el => el.scrollWidth > el.clientWidth), false);
  assert.deepEqual(errors, []);
  console.log('PASS: 14–16px text, secondary contrast >= 4.5:1, EN/ZH/DE/AR, light/dark, 850/1180px, visible modal footer, theme placement and keyboard, mini layout.');
} finally {
  if (desktop) { const proc = desktop.process(); await Promise.race([desktop.close().catch(() => {}), new Promise(r => setTimeout(r, 4000))]); proc.kill(); }
}
