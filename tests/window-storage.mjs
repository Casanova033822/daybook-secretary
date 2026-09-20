import { _electron as electron, expect } from '@playwright/test';
import { mkdirSync, mkdtempSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
mkdirSync('test-results', { recursive: true });
const env = { ...process.env, DAYBOOK_TEST: '1', DAYBOOK_DATA_DIR: mkdtempSync(resolve('test-results/window-storage-')) };
delete env.ELECTRON_RUN_AS_NODE;
let desktop;
try {
  desktop = await electron.launch({ args: [resolve('.')], env });
  const page = await desktop.firstWindow();
  await page.locator('.workspace').waitFor();
  await page.evaluate(() => window.daybook.windowAction('full'));
  await desktop.evaluate(() => {
    const { DatabaseSync } = process.getBuiltinModule('node:sqlite');
    const original = DatabaseSync.prototype.prepare;
    globalThis.restoreWindowStore = () => { DatabaseSync.prototype.prepare = original; };
    DatabaseSync.prototype.prepare = function (sql) {
      const statement = original.call(this, sql);
      if (!sql.startsWith('INSERT OR REPLACE INTO meta')) return statement;
      return { run: (key, value) => {
        if (key.startsWith('bounds-') || key === 'last-mode') throw new Error('simulated window preference write failure');
        return statement.run(key, value);
      } };
    };
  });
  await page.evaluate(() => window.daybook.windowAction('close'));
  assert.equal(await desktop.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isVisible()), false);
  await page.evaluate(() => window.daybook.windowAction('mini'));
  await expect(page.locator('.mini-mode')).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('simulated window preference write failure');
  await page.evaluate(() => window.daybook.windowAction('full'));
  await expect(page.locator('.mini-mode')).toHaveCount(0);
  console.log('PASS: preference write failures do not block tray hiding or mode changes.');
} finally {
  if (desktop) {
    await desktop.evaluate(() => globalThis.restoreWindowStore?.()).catch(() => {});
    const proc = desktop.process(); await Promise.race([desktop.close().catch(() => {}), new Promise(resolve => setTimeout(resolve, 4000))]); proc.kill();
  }
}
