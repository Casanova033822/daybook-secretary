export const pad = (value: number) => String(value).padStart(2, '0');
export function dateKey(date: Date = new Date()): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
export function localStamp(date: Date): string { return `${dateKey(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}`; }
export function validDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00`);
  return Number.isFinite(+date) && dateKey(date) === value && date.getFullYear() >= 1900 && date.getFullYear() <= 9998;
}
export function addDays(value: string, days: number): string {
  const date = new Date(`${value}T12:00:00`); date.setDate(date.getDate() + days); return dateKey(date);
}
export function dayDifference(a: string, b: string): number { return Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86400000); }
export function shiftStamp(stamp: string, days: number): string { return `${addDays(stamp.slice(0, 10), days)}${stamp.slice(10)}`; }
export function parseClock(date: string, hourText: string, minuteText: string): string {
  if (!validDate(date)) throw new Error('請輸入有效的日期。');
  if (!/^\d{1,2}$/.test(hourText) || !/^\d{1,2}$/.test(minuteText)) throw new Error('小時與分鐘請輸入整數。');
  const hour = Number(hourText), minute = Number(minuteText);
  if (hour < 0 || hour > 24 || minute < 0 || minute > 59 || (hour === 24 && minute !== 0)) throw new Error('小時須為 00～24、分鐘須為 00～59；24 點僅接受 00 分。');
  return hour === 24 ? `${addDays(date, 1)}T00:00` : `${date}T${pad(hour)}:${pad(minute)}`;
}
export function validStamp(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return false;
  try { return parseClock(value.slice(0, 10), value.slice(11, 13), value.slice(14, 16)) === value && localStamp(new Date(value)) === value; } catch { return false; }
}
export function clock(stamp: string): string { return stamp.slice(11, 16); }
export function intersects(start: string, end: string, from: string, to: string): boolean { return start < `${to}T00:00` && end > `${from}T00:00`; }
