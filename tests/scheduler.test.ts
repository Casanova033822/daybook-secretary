import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Store } from '../electron/store.js';
import { Scheduler } from '../electron/scheduler.js';
import type { ItemInput, ReminderDeliveryResult } from '../src/shared/types.js';
import { reminderCandidates } from '../src/shared/domain.js';
import { locales } from '../src/shared/appearance.js';
import { translateError } from '../src/shared/i18n.js';
const now = +new Date('2026-09-20T15:00:00');
const value: ItemInput = { title: '測試', notes: '', date: '2026-09-20', startAt: '2026-09-20T15:00', endAt: '2026-09-20T16:00', repeat: { kind: 'none', weekdays: [], until: null }, reminders: [{ anchor: 'start', minutes: 0 }] };
const shown: ReminderDeliveryResult = { display: 'shown', audio: 'played' };
function seed() { const store = new Store(':memory:'); const id = store.save({ value }, now - 3600000); return { store, id }; }

test('scheduler failure details can be retranslated in every supported language', async () => {
  const { store } = seed(); const errors: string[] = [];
  const scheduler = new Scheduler(store, async () => ({ display: 'failed', audio: 'not-attempted', error: '提醒視窗未能顯示。' }), error => errors.push(error));
  for (const offset of [0, 2000, 7000]) await scheduler.tick(now + offset);
  store.close();
  assert.equal(errors.length, 3);
  assert.match(translateError(errors[2], 'en-US'), /3/);
  for (const locale of locales) for (const error of errors) {
    const translated = translateError(error, locale);
    assert.doesNotMatch(translated, /DAYBOOK_MESSAGE|\{detail\}/);
    if (!['zh-TW', 'zh-CN', 'ja'].includes(locale)) assert.doesNotMatch(translated, /[\u3400-\u9fff]/);
  }
  const receipt = seed(); const receiptErrors: string[] = [];
  receipt.store.markDelivered = () => { throw new Error('disk full'); };
  await new Scheduler(receipt.store, async () => ({ display: 'shown', audio: 'failed', error: '音效播放逾時。' }), error => receiptErrors.push(error)).tick(now);
  assert.equal(receiptErrors.length, 2);
  for (const error of receiptErrors) assert.doesNotMatch(translateError(error, 'en-US'), /[\u3400-\u9fff]|DAYBOOK_MESSAGE|\{detail\}/);
  receipt.store.close();
});
test('display failure retries, success deduplicates, and audio failure never repeats a displayed card', async () => {
  const { store } = seed(); let calls = 0; const errors: string[] = [];
  const scheduler = new Scheduler(store, async () => ++calls === 1 ? { display: 'failed', audio: 'not-attempted' } : { display: 'shown', audio: 'failed', error: 'audio unavailable' }, error => errors.push(error));
  const delivery = reminderCandidates(store.snapshot(), now - 1, now)[0].id;
  await scheduler.tick(now); assert.equal(store.hasDelivered(delivery), false);
  await scheduler.tick(now + 1000); assert.equal(calls, 1);
  await scheduler.tick(now + 2000); assert.equal(store.hasDelivered(delivery), true);
  await scheduler.tick(now + 5000, true); assert.equal(calls, 2);
  assert.equal(errors.length, 2); store.close();
});
test('completion, reschedule and deletion invalidate pending retries', async () => {
  for (const action of ['complete', 'move', 'delete']) {
    const { store, id } = seed(); let calls = 0;
    const scheduler = new Scheduler(store, async () => { calls++; return { display: 'failed', audio: 'not-attempted' }; });
    await scheduler.tick(now);
    const target = { itemId: id, occurrenceDate: value.date, scope: 'single' as const };
    if (action === 'complete') store.complete({ ...target, completed: true }, now + 500);
    if (action === 'move') store.save({ target, value: { ...value, startAt: '2026-09-20T17:00', endAt: '2026-09-20T18:00' } }, now + 500);
    if (action === 'delete') store.remove(target);
    await scheduler.tick(now + 2000); assert.equal(calls, 1, action); store.close();
  }
});
test('concurrent ticks share one asynchronous delivery; same-time items form one batch', async () => {
  const { store } = seed(); store.save({ value: { ...value, title: '另一件' } }, now - 1000);
  let calls = 0, count = 0, finish!: (result: ReminderDeliveryResult) => void;
  const scheduler = new Scheduler(store, due => { calls++; count = due.length; return new Promise(resolve => { finish = resolve; }); });
  const first = scheduler.tick(now); const second = scheduler.tick(now + 1000, true);
  assert.equal(first, second); assert.equal(calls, 1); assert.equal(count, 2);
  finish(shown); await first; await scheduler.tick(now + 2000); assert.equal(calls, 1); store.close();
});
test('persistent visual failure stops after three attempts; restart can retry undelivered reminders', async () => {
  const { store } = seed(); let calls = 0;
  const scheduler = new Scheduler(store, async () => { calls++; throw new Error('window creation failed'); });
  for (const offset of [0, 2000, 7000, 12000, 20000]) await scheduler.tick(now + offset);
  assert.equal(calls, 3);
  await new Scheduler(store, async () => { calls++; return shown; }).tick(now + 30000);
  assert.equal(calls, 4); store.close();
});
test('shutdown during asynchronous delivery never writes to a closed database', async () => {
  const { store } = seed(); let finish!: (result: ReminderDeliveryResult) => void;
  const scheduler = new Scheduler(store, () => new Promise(resolve => { finish = resolve; }));
  const pending = scheduler.tick(now); scheduler.dispose(); store.close(); finish(shown); await pending;
});
