import { locales, type Locale } from './appearance.js';
import { messages } from './messages.js';
import { editorMessages } from './messages-editor.js';
import { settingsMessages } from './messages-settings.js';
import { errorMessages } from './messages-errors.js';
import type { Reminder } from './types.js';

export const catalog = { ...messages, ...editorMessages, ...settingsMessages, ...errorMessages };
export const aliases = {
  '尚未排時間': '尚未安排時間', '待安排時間': '尚未安排時間', '已經完成': '已完成',
  '當日時間表': '時間表', '結束於': '結束', ' · 重疊': '時段重疊',
  '關閉錯誤訊息': '關閉',
  '把時間，留給眼前這一件': '把時間，留給眼前這一件。',
  '日序小卡＋提示音測試': '提醒測試 · 請確認小卡與提示音',
  '行程識別資料不正確。': '行程資料格式不正確。', '行程資料不正確。': '行程資料格式不正確。',
  '完成狀態不正確。': '行程資料格式不正確。', '無效的視窗操作。': '無效的程式呼叫。',
  '無效的提醒視窗呼叫。': '無效的程式呼叫。', '無效的音效結果。': '無效的程式呼叫。',
  '無效的提醒事項。': '行程資料格式不正確。', '提醒視窗未能顯示。': '提醒小卡未能顯示，請再試一次。',
  '提醒視窗在顯示前關閉。': '提醒小卡未能顯示，請再試一次。',
} as const satisfies Record<string, keyof typeof catalog>;
export type MessageKey = keyof typeof catalog | keyof typeof aliases;
type Params = Record<string, string | number>;
const columns = Object.fromEntries(Object.entries(catalog).map(([key, row]) => [key, row.split('|')])) as Record<keyof typeof catalog, string[]>;
export function translate(locale: Locale, key: MessageKey, params: Params = {}): string {
  const canonical = key in aliases ? aliases[key as keyof typeof aliases] : key as keyof typeof catalog;
  const template = locale === 'zh-TW' ? key : columns[canonical]?.[locales.indexOf(locale) - 1] ?? columns[canonical]?.[1] ?? key;
  return template.replace(/\{(\w+)\}/g, (placeholder, name: string) => params[name] === undefined ? placeholder : String(params[name]));
}
// Each Electron process has its own module instance. Renderer locale is set before rendering.
let activeLocale: Locale = 'zh-TW';
export function setLocale(locale: Locale): void { activeLocale = locale; }
export function getLocale(): Locale { return activeLocale; }
export function t(key: MessageKey, params?: Params): string { return translate(activeLocale, key, params); }
export function translateError(message: string, locale: Locale = activeLocale): string {
  const clean = message.replace(/^Error invoking remote method '[^']+': /, '').replace(/^Error: /, '');
  if (clean.startsWith('DAYBOOK_MESSAGE:')) {
    try {
      const { key, params } = JSON.parse(clean.slice('DAYBOOK_MESSAGE:'.length));
      if (key in catalog || key in aliases) return translate(locale, key, Object.fromEntries(Object.entries(params ?? {}).map(([name, value]) => [name, typeof value === 'string' ? translateError(value, locale) : String(value)])));
    } catch { /* fall through for malformed external errors */ }
  }
  if (clean in catalog || clean in aliases) return translate(locale, clean as MessageKey);
  return clean;
}
export function localizedError(key: MessageKey, params: Params = {}): Error {
  return new Error(`DAYBOOK_MESSAGE:${JSON.stringify({ key, params })}`);
}
export function reminderText(rule: Reminder, locale: Locale = activeLocale): string {
  return translate(locale, rule.minutes ? rule.anchor === 'start' ? '開始前 {minutes} 分鐘' : '結束前 {minutes} 分鐘' : rule.anchor === 'start' ? '開始當下' : '結束當下', { minutes: rule.minutes });
}
export function weekdayNames(width: 'narrow' | 'short' | 'long' = 'short'): string[] {
  const formatter = new Intl.DateTimeFormat(activeLocale, { weekday: width });
  return Array.from({ length: 7 }, (_, i) => formatter.format(new Date(2026, 8, 20 + i, 12)));
}
export function appTitle(locale: Locale = activeLocale): string { return `${translate(locale, '日序')} · ${translate(locale, '私人秘書')}`; }
