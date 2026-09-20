import type { Exception, Item, ItemInput, Occurrence, OccurrenceState, Reminder, Repeat, Snapshot } from './types.js';
import { addDays, dateKey, dayDifference, intersects, shiftStamp, validDate, validStamp } from './time.js';

export const DEFAULT_REMINDERS: Reminder[] = [{ anchor: 'start', minutes: 10 }, { anchor: 'start', minutes: 0 }];
export const PRESET_TITLES = ['冥想', '去健身', '早餐', '午餐', '晚餐', '洗澡'] as const;
export function validateReminders(value: unknown): Reminder[] {
  if (!Array.isArray(value) || value.length > 20) throw new Error('每筆行程最多設定 20 個提醒。');
  const keys = new Set<string>();
  return value.map(rule => {
    if (!rule || !['start', 'end'].includes(rule.anchor) || !Number.isSafeInteger(rule.minutes) || rule.minutes < 0 || rule.minutes > 525600) throw new Error('提醒分鐘數須為 0～525600 的整數。');
    const key = `${rule.anchor}:${rule.minutes}`;
    if (keys.has(key)) throw new Error('提醒時間重複，請保留一個即可。');
    keys.add(key); return { anchor: rule.anchor, minutes: rule.minutes };
  });
}
export function validateInput(value: unknown): ItemInput {
  if (!value || typeof value !== 'object') throw new Error('行程資料格式不正確。');
  const v = value as ItemInput;
  if (typeof v.title !== 'string' || !v.title.trim() || v.title.length > 200) throw new Error('請輸入事項名稱（最多 200 字）。');
  if (typeof v.notes !== 'string' || v.notes.length > 10000) throw new Error('備註最多 10000 字。');
  if (!validDate(v.date)) throw new Error('請輸入有效的日期。');
  if ((v.startAt === null) !== (v.endAt === null)) throw new Error('請完整設定開始與結束時間。');
  if (v.startAt !== null && (!validStamp(v.startAt) || !validStamp(v.endAt) || v.startAt.slice(0, 10) !== v.date || v.endAt <= v.startAt)) throw new Error('請檢查日期時間，結束時間須晚於開始時間。');
  const r = v.repeat;
  if (!r || !['none', 'daily', 'weekly'].includes(r.kind) || !Array.isArray(r.weekdays) || r.weekdays.some(d => !Number.isInteger(d) || d < 0 || d > 6)) throw new Error('重複設定不正確。');
  if (r.kind === 'weekly' && r.weekdays.length === 0) throw new Error('請至少選擇一個星期。');
  if (r.kind !== 'none' && r.until !== null && (!validDate(r.until) || r.until < v.date)) throw new Error('重複截止日期不能早於開始日期。');
  return { title: v.title.trim(), notes: v.notes, date: v.date, startAt: v.startAt, endAt: v.endAt,
    repeat: r.kind === 'none' ? { kind: 'none', weekdays: [], until: null } : { kind: r.kind, weekdays: [...new Set(r.weekdays)].sort(), until: r.until }, reminders: validateReminders(v.reminders) };
}
export function occursOn(item: Item, date: string): boolean {
  if (date < item.date || (item.repeat.until && date > item.repeat.until)) return false;
  if (item.repeat.kind === 'none') return date === item.date;
  return item.repeat.kind === 'daily' || item.repeat.weekdays.includes(new Date(`${date}T12:00:00`).getDay());
}
export function makeOccurrence(item: Item, date: string, exception?: Exception, state?: OccurrenceState): Occurrence {
  const delta = dayDifference(date, item.date);
  const value = exception?.value ?? { ...item, date, startAt: item.startAt ? shiftStamp(item.startAt, delta) : null, endAt: item.endAt ? shiftStamp(item.endAt, delta) : null };
  return { ...value, repeat: item.repeat, key: `${item.id}@${date}`, itemId: item.id, occurrenceDate: date,
    recurring: item.repeat.kind !== 'none', completedAt: state?.completedAt ?? null,
    notBefore: Math.max(item.updatedAt, exception?.updatedAt ?? 0, state?.notBefore ?? 0) };
}
export function expand(snapshot: Pick<Snapshot, 'items' | 'exceptions' | 'states'>, from: string, to: string): Occurrence[] {
  if (!validDate(from) || !validDate(to) || to <= from) return [];
  const results: Occurrence[] = [];
  const exceptions = new Map(snapshot.exceptions.map(e => [`${e.itemId}@${e.occurrenceDate}`, e]));
  const states = new Map(snapshot.states.map(s => [`${s.itemId}@${s.occurrenceDate}`, s]));
  for (const item of snapshot.items) {
    const durationDays = item.endAt && item.startAt ? Math.max(0, dayDifference(item.endAt.slice(0, 10), item.startAt.slice(0, 10))) : 0;
    const start = item.repeat.kind === 'none' ? item.date : [addDays(from, -durationDays), item.date].sort().at(-1)!;
    const end = item.repeat.kind === 'none' ? addDays(item.date, 1) : (item.repeat.until && item.repeat.until < to ? addDays(item.repeat.until, 1) : to);
    for (let day = start; day < end; day = addDays(day, 1)) {
      if (!occursOn(item, day)) continue;
      const key = `${item.id}@${day}`, ex = exceptions.get(key);
      if (ex?.deleted || ex?.value) continue;
      const occurrence = makeOccurrence(item, day, ex, states.get(key));
      if (inRange(occurrence, from, to)) results.push(occurrence);
    }
    // Detached occurrences may have moved into this range from outside it.
    for (const ex of snapshot.exceptions.filter(e => e.itemId === item.id && !e.deleted && e.value && occursOn(item, e.occurrenceDate))) {
      const occurrence = makeOccurrence(item, ex.occurrenceDate, ex, states.get(`${item.id}@${ex.occurrenceDate}`));
      if (inRange(occurrence, from, to)) results.push(occurrence);
    }
  }
  return results.sort((a, b) => (a.startAt ?? `${a.date}T99:99`).localeCompare(b.startAt ?? `${b.date}T99:99`) || a.title.localeCompare(b.title, 'zh-Hant'));
}
function inRange(o: Occurrence, from: string, to: string): boolean { return o.startAt && o.endAt ? intersects(o.startAt, o.endAt, from, to) : o.date >= from && o.date < to; }
export function conflictingKeys(occurrences: Occurrence[]): Set<string> {
  const timed = occurrences.filter(o => o.startAt && o.endAt && !o.completedAt);
  const keys = new Set<string>();
  for (let i = 0; i < timed.length; i++) for (let j = i + 1; j < timed.length; j++) {
    if (timed[i].startAt! < timed[j].endAt! && timed[j].startAt! < timed[i].endAt!) { keys.add(timed[i].key); keys.add(timed[j].key); }
  }
  return keys;
}
export function isActive(o: Occurrence, now: number): boolean { return !o.completedAt && !!o.startAt && !!o.endAt && +new Date(o.startAt) <= now && +new Date(o.endAt) > now; }
export type DueReminder = { id: string; at: number; occurrence: Occurrence; rule: Reminder };
export function reminderCandidates(snapshot: Snapshot, from: number, to: number): DueReminder[] {
  let maximumOffset = 0;
  for (const item of snapshot.items) for (const rule of item.reminders) maximumOffset = Math.max(maximumOffset, rule.minutes);
  for (const exception of snapshot.exceptions) for (const rule of exception.value?.reminders ?? []) maximumOffset = Math.max(maximumOffset, rule.minutes);
  const occurrences = expand(snapshot, dateKey(new Date(from)), addDays(dateKey(new Date(to + maximumOffset * 60000)), 1));
  return occurrences.filter(o => !o.completedAt && o.startAt && o.endAt).flatMap(occurrence => occurrence.reminders.map(rule => {
    const at = +new Date(rule.anchor === 'start' ? occurrence.startAt! : occurrence.endAt!) - rule.minutes * 60000;
    return { id: `${occurrence.key}:${rule.anchor}:${rule.minutes}:${at}`, at, occurrence, rule };
  })).filter(r => r.at > from && r.at <= to && r.at >= r.occurrence.notBefore).sort((a, b) => a.at - b.at);
}
