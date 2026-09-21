import { _electron as electron, expect } from '@playwright/test';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
mkdirSync('test-results', { recursive: true });
const env = { ...process.env, DAYBOOK_TEST: '1', DAYBOOK_DATA_DIR: mkdtempSync(resolve('test-results/layout-')) };
const version = JSON.parse(readFileSync('package.json', 'utf8')).version;
delete env.ELECTRON_RUN_AS_NODE;
let desktop;
try {
  desktop = await electron.launch({ args: [resolve('.')], env });
  const page = await desktop.firstWindow();
  await page.getByRole('heading', { name: '今天，照自己的步調。' }).waitFor();
  await page.evaluate(async () => {
    const d = new Date(), date = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const next = new Date(+d + 86400000), tomorrow = `${next.getFullYear()}-${String(next.getMonth()+1).padStart(2,'0')}-${String(next.getDate()).padStart(2,'0')}`;
    const base = { notes: '', date, repeat: { kind: 'none', weekdays: [], until: null }, reminders: [{ anchor: 'start', minutes: 10 }] };
    for (const [title, start, end, notes] of [['冥想', '09:00', '09:30', ''], ['專注工作', '15:00', '16:00', '整理今天的想法，完成手邊的事情。'], ['去健身，練習喜歡的項目並記錄今天的進度', '18:00', '19:00', ''], ['睡前閱讀', '23:30', '00:15', '']])
      await window.daybook.save({ value: { ...base, title, notes, startAt: `${date}T${start}`, endAt: `${end < start ? tomorrow : date}T${end}` } });
    const item = (await window.daybook.snapshot()).items.find(i => i.title === '冥想');
    await window.daybook.complete({ itemId: item.id, occurrenceDate: date, completed: true });
  });
  await expect(page.getByTestId('agenda-row')).toHaveCount(4);
  const measurements = [];
  for (const width of [1180, 850]) {
    await desktop.evaluate(({ BrowserWindow }, width) => { const win = BrowserWindow.getAllWindows()[0]; win.setBounds({ x: 100, y: 50, width, height: 820 }); win.showInactive(); }, width);
    await page.waitForTimeout(300);
    const measure = await page.evaluate(() => {
      const box = el => ({ x: el.getBoundingClientRect().x, width: el.getBoundingClientRect().width, height: el.getBoundingClientRect().height });
      return { header: [...document.querySelector('.list-column-labels').children].map(box), rows: [...document.querySelectorAll('.agenda-row.timed')].map(row => ({ cells: [...row.children].map(box), height: row.getBoundingClientRect().height, time: row.querySelector('.row-time strong').textContent, whitespace: getComputedStyle(row.querySelector('.row-time strong')).whiteSpace, timeSize: getComputedStyle(row.querySelector('.row-time strong')).fontSize })), filler: document.body.innerText.includes('留給這件事'), overflow: document.querySelector('.workspace').scrollWidth > document.querySelector('.workspace').clientWidth };
    });
    for (const row of measure.rows) {
      assert.equal(row.cells.length, 6);
      row.cells.forEach((cell, i) => assert.ok(Math.abs(cell.x - measure.header[i].x) < 1));
      assert.equal(row.whitespace, 'nowrap'); assert.equal(row.timeSize, '14px'); assert.ok(row.height >= 84);
      assert.match(row.time, /^\d{2}:\d{2} - \d{2}:\d{2}$/);
    }
    assert.equal(measure.filler, false); assert.equal(measure.overflow, false);
    const strike = await page.locator('.agenda-row.completed').first().evaluate(el => {
      const style = getComputedStyle(el, '::after');
      return { content: style.content, width: parseFloat(style.width), rowWidth: el.clientWidth, height: style.height, pointerEvents: style.pointerEvents };
    });
    assert.equal(strike.content, '""'); assert.equal(strike.height, '2px');
    assert.equal(strike.width, strike.rowWidth); assert.equal(strike.pointerEvents, 'none');
    await expect(page.locator('.row-time > span')).toContainText('結束於');
    await page.screenshot({ path: `test-results/${version}-agenda-${width}.png` });
    measurements.push({ width, ...measure });
  }
  const session = await desktop.context().newCDPSession(page);
  await page.evaluate(async () => {
    const snapshot = await window.daybook.snapshot(), date = snapshot.items[0].date;
    await window.daybook.save({ value: { title: 'Finished to-do', notes: 'Notes must stay readable', date, startAt: null, endAt: null, reminders: [], repeat: { kind: 'none', weekdays: [], until: null } } });
    const item = (await window.daybook.snapshot()).items.find(i => i.title === 'Finished to-do');
    await window.daybook.complete({ itemId: item.id, occurrenceDate: date, completed: true });
  });
  for (const theme of ['light', 'dark']) {
    await page.evaluate(theme => window.daybook.saveAppearance({ theme }), theme);
    for (const mode of ['full', 'mini']) {
      await page.evaluate(mode => window.daybook.windowAction(mode), mode);
      if (mode === 'mini') await expect(page.locator('.app')).toHaveClass(/mini-mode/);
      else await expect(page.locator('.app')).not.toHaveClass(/mini-mode/);
      await expect(page.locator('.agenda-row.completed')).toHaveCount(2);
      for (const row of await page.locator('.agenda-row.completed').all()) {
        const strike = await row.evaluate(el => {
          const style = getComputedStyle(el, '::after');
          return { content: style.content, width: parseFloat(style.width), expected: el.clientWidth, pointerEvents: style.pointerEvents };
        });
        assert.equal(strike.content, '""'); assert.equal(strike.width, strike.expected); assert.equal(strike.pointerEvents, 'none');
      }
      const todo = page.getByTestId('agenda-row').filter({ hasText: 'Finished to-do' });
      await todo.getByRole('checkbox').click(); await expect(todo).not.toHaveClass(/completed/);
      assert.equal(await todo.evaluate(el => getComputedStyle(el, '::after').content), 'none');
      await todo.getByRole('checkbox').click(); await expect(todo).toHaveClass(/completed/);
      await page.screenshot({ path: `test-results/completed-row-${theme}-${mode}.png` });
      await todo.locator('.row-main').click(); await expect(page.getByRole('dialog')).toBeVisible(); await page.keyboard.press('Escape');
    }
    await page.evaluate(() => window.daybook.windowAction('full'));
    for (const view of ['週', '月']) {
      await page.getByRole('button', { name: view, exact: true }).click();
      await expect(page.locator('.event-completed .calendar-event-inner').first()).toBeVisible();
      const strike = await page.locator('.event-completed .calendar-event-inner').first().evaluate(el => ({ content: getComputedStyle(el, '::after').content, width: parseFloat(getComputedStyle(el, '::after').width), expected: el.clientWidth }));
      assert.equal(strike.content, '""'); assert.ok(Math.abs(strike.width - strike.expected) <= 1);
    }
    await page.getByRole('button', { name: '日', exact: true }).click();
  }
  await session.send('DOM.enable'); await session.send('CSS.enable');
  const { root } = await session.send('DOM.getDocument');
  const { nodeId } = await session.send('DOM.querySelector', { nodeId: root.nodeId, selector: '.row-title strong' });
  const fonts = await session.send('CSS.getPlatformFontsForNode', { nodeId });
  assert.ok(fonts.fonts.some(font => font.glyphCount > 0), JSON.stringify(fonts));
  assert.match(await page.locator('html').evaluate(el => getComputedStyle(el).fontFamily), /Segoe UI.*Microsoft JhengHei UI.*Nirmala UI/);
  // Force a missing primary family to exercise the operating-system fallback path.
  await page.locator('html').evaluate(el => { el.style.fontFamily = '"Daybook Missing Font", "Microsoft JhengHei", sans-serif'; });
  await page.evaluate(() => document.fonts.ready);
  const fallbackFonts = await session.send('CSS.getPlatformFontsForNode', { nodeId });
  assert.ok(fallbackFonts.fonts.some(font => font.glyphCount > 0));
  assert.ok(fallbackFonts.fonts.every(font => !font.familyName.includes('Noto Sans TC')));
  assert.equal(await page.locator('.workspace').evaluate(el => el.scrollWidth > el.clientWidth), false);
  await page.screenshot({ path: `test-results/${version}-fallback-font.png` });
  writeFileSync('test-results/layout-verification.json', JSON.stringify({ measurements, fonts, fallbackFonts }, null, 2));
  console.log(`PASS: local font/fallback (${fonts.fonts.map(f => f.familyName).join(', ')}), 1180/850 widths, six aligned columns, readable rows, horizontal times, cross-day note, completed strike-through.`);
} finally { if (desktop) { const proc = desktop.process(); await Promise.race([desktop.close().catch(() => {}), new Promise(r => setTimeout(r, 4000))]); proc.kill(); } }
