import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { Store } from '../electron/store.js';
import { locales } from '../src/shared/appearance.js';
import { PRESET_TITLES } from '../src/shared/domain.js';
import { translate } from '../src/shared/i18n.js';

const english = ['meditation', 'workout', 'breakfast', 'lunch', 'dinner', 'shower'];
test('fresh preset defaults are English for every interface language', () => {
  for (const locale of locales) {
    const store = new Store(':memory:', { locale, theme: 'dark' });
    assert.deepEqual(store.snapshot().presets.map(p => p.title), english);
    store.saveAppearance({ locale: 'zh-TW' });
    assert.deepEqual(store.snapshot().presets.map(p => p.title), english);
    store.close();
  }
});

test('intact legacy defaults migrate once, preserving IDs, settings and item titles', () => {
  mkdirSync('test-results', { recursive: true });
  for (const locale of locales) {
    const path = join(mkdtempSync(join('test-results', 'preset-upgrade-')), 'data.sqlite');
    let store = new Store(path, { locale, theme: 'dark' });
    const legacy = PRESET_TITLES.map((title, i) => ({ id: `original-${i}`, title: translate(locale, title) }));
    store.setMeta('presets', legacy); store.setMeta('english-preset-defaults-v1', true); store.setMeta('english-preset-defaults-v2', false);
    store.save({ value: { title: legacy[0].title, notes: 'Keep my text', date: '2026-09-21', startAt: null, endAt: null, repeat: { kind: 'none', weekdays: [], until: null }, reminders: [] } });
    const before = store.snapshot(); store.close();
    store = new Store(path);
    assert.deepEqual(store.snapshot().presets, legacy.map((p, i) => ({ ...p, title: english[i] })));
    assert.deepEqual(store.snapshot().items, before.items);
    assert.deepEqual(store.snapshot().settings, before.settings);
    // A user's later choice must not be translated again on the next launch.
    store.savePresets(legacy); store.close(); store = new Store(path);
    assert.deepEqual(store.snapshot().presets, legacy); store.close();
  }
});

test('legacy custom, reordered and empty preset lists remain untouched', () => {
  mkdirSync('test-results', { recursive: true });
  const defaults = PRESET_TITLES.map((title, i) => ({ id: String(i), title }));
  for (const presets of [[], [...defaults].reverse(), defaults.map((p, i) => i === 1 ? { ...p, title: '我的自訂運動' } : p), [...defaults, { id: 'extra', title: '喝水' }]]) {
    const path = join(mkdtempSync(join('test-results', 'preset-custom-')), 'data.sqlite');
    let store = new Store(path); store.setMeta('presets', presets); store.setMeta('english-preset-defaults-v2', false); store.close();
    store = new Store(path); assert.deepEqual(store.snapshot().presets, presets); store.close();
  }
});
