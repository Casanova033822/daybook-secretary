import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Store } from '../electron/store.js';
import { languages, locales, systemLocale } from '../src/shared/appearance.js';
import { aliases, catalog, translate, translateError } from '../src/shared/i18n.js';

test('all 14 dictionaries have complete, nonempty translations and matching parameters', () => {
  const params = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort();
  for (const [key, value] of Object.entries(catalog)) {
    const entries = value.split('|');
    assert.equal(entries.length, 13, key);
    for (const [i, entry] of entries.entries()) {
      assert.ok(entry.trim(), `${key}: ${locales[i + 1]}`);
      assert.deepEqual(params(entry), params(key), `${key}: ${locales[i + 1]}`);
    }
  }
  for (const key of Object.keys(aliases) as (keyof typeof aliases)[]) for (const locale of locales) assert.ok(translate(locale, key));
  assert.equal(translate('en-US', '已完成 {done} / {total} 件事項', { done: 1, total: 2 }), 'Completed: 1 / 2');
  assert.equal(translateError("Error invoking remote method 'settings': Error: 設定格式不正確。", 'en-US'), 'Invalid settings.');
  assert.equal(translate('en-US', '與「{titles}」時段重疊，仍可儲存。', { titles: '<script>{done}|冥想' }), 'Overlaps with “<script>{done}|冥想”. You can still save.');
});

test('Windows language mapping handles scripts, regions, preference order and fallbacks', () => {
  for (const tag of ['zh-TW', 'zh-HK', 'zh-MO', 'zh-Hant', 'zh_Hant_HK']) assert.equal(systemLocale([tag]), 'zh-TW');
  for (const tag of ['zh-CN', 'zh-SG', 'zh-Hans', 'zh']) assert.equal(systemLocale([tag]), 'zh-CN');
  assert.equal(systemLocale(['pt-PT']), 'pt-BR');
  assert.equal(systemLocale(['fr-CA']), 'fr');
  assert.equal(systemLocale(['xx-YY', 'ja-JP']), 'ja');
  assert.equal(systemLocale(['xx-YY']), 'en-US');
  assert.equal(systemLocale([]), 'en-US');
});

test('appearance migration preserves existing settings, presets and persistence', () => {
  mkdirSync('test-results', { recursive: true });
  const dir = mkdtempSync(join('test-results', 'appearance-store-')), path = join(dir, 'data.sqlite');
  let store = new Store(path);
  const legacy = { launchOnLogin: false, alwaysOnTop: true, defaultReminders: [{ anchor: 'end', minutes: 12 }] };
  const presets = [{ id: 'custom', title: '使用者的文字' }];
  store.setMeta('settings', legacy); store.setMeta('presets', presets); store.close();
  store = new Store(path, { theme: 'dark', locale: 'ja' });
  assert.deepEqual(store.snapshot().settings, { ...legacy, theme: 'dark', locale: 'ja' });
  assert.deepEqual(store.snapshot().presets, presets);
  const stale = store.snapshot().settings;
  store.saveAppearance({ locale: 'ar' }); store.saveAppearance({ theme: 'light' });
  store.saveSettings({ ...stale, alwaysOnTop: false });
  assert.equal(store.snapshot().settings.locale, 'ar');
  assert.equal(store.snapshot().settings.theme, 'light');
  store.close();
  store = new Store(path, { theme: 'dark', locale: 'en-US' });
  assert.equal(store.snapshot().settings.locale, 'ar');
  assert.equal(store.snapshot().settings.theme, 'light');
  store.close();
});

test('appearance writes validate input and do not change persisted state after a failure', () => {
  const store = new Store(':memory:', { theme: 'dark', locale: 'fr' });
  assert.equal(store.snapshot().presets[0].title, 'Méditer');
  const previous = store.snapshot();
  for (const invalid of [null, [], { locale: 'xx' }, { theme: 'system' }, { alwaysOnTop: true }, { locale: null }]) assert.throws(() => store.saveAppearance(invalid));
  const set = store.setMeta.bind(store);
  store.setMeta = () => { throw new Error('simulated write failure'); };
  assert.throws(() => store.saveAppearance({ locale: 'de' }));
  assert.deepEqual(store.snapshot(), previous);
  store.setMeta = set; store.close();
});

test('all flags are bundled SVGs without scripts or outbound resource references', () => {
  assert.equal(languages.length, 14);
  assert.equal(languages.find(l => l.locale === 'zh-TW')?.flag, 'hk');
  assert.equal(languages.find(l => l.locale === 'zh-CN')?.flag, 'cn');
  for (const language of languages) {
    const svg = readFileSync(`assets/flags/${language.flag}.svg`, 'utf8');
    assert.match(svg, /<svg\b/);
    assert.doesNotMatch(svg, /<script|<foreignObject|\son\w+=|(?:href|src)=["'](?:https?:|\/\/)|url\(https?:/i);
  }
});
