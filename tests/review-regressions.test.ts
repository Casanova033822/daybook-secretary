import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Store } from '../electron/store.js';
import { Scheduler } from '../electron/scheduler.js';
import { expand, reminderCandidates } from '../src/shared/domain.js';
import type { ItemInput, Snapshot } from '../src/shared/types.js';

const now = +new Date('2026-09-20T15:00:00');
const value: ItemInput = { title: 'Review fixture', notes: '', date: '2026-09-20', startAt: '2026-09-20T15:00', endAt: '2026-09-20T16:00', repeat: { kind: 'none', weekdays: [], until: null }, reminders: [{ anchor: 'start', minutes: 0 }] };

test('turning recurrence off discards a hidden cutoff when moving the one-off event', () => {
  const store = new Store(':memory:');
  try {
    const id = store.save({ value: { ...value, repeat: { kind: 'daily', weekdays: [], until: '2026-09-22' } } }, now - 60000);
    store.save({ target: { itemId: id, occurrenceDate: value.date, scope: 'future' }, value: {
      ...value, date: '2026-10-01', startAt: '2026-10-01T15:00', endAt: '2026-10-01T16:00',
      repeat: { kind: 'none', weekdays: [0], until: '2026-09-22' },
    } }, now);
    const [item] = store.snapshot().items;
    assert.deepEqual(item.repeat, { kind: 'none', weekdays: [], until: null });
    assert.equal(expand(store.snapshot(), '2026-10-01', '2026-10-02').length, 1);
  } finally { store.close(); }
});

test('delivery-record write failure retries storage without redisplaying a shown reminder', async () => {
  const store = new Store(':memory:');
  let scheduler: Scheduler | undefined;
  try {
    store.save({ value }, now - 60000);
    const delivery = reminderCandidates(store.snapshot(), now - 1, now)[0].id;
    const mark = store.markDelivered.bind(store);
    let writes = 0, displays = 0;
    store.markDelivered = (ids, at) => { if (++writes === 1) throw new Error('simulated SQLITE_BUSY'); mark(ids, at); };
    scheduler = new Scheduler(store, async () => { displays++; return { display: 'shown', audio: 'played' }; });
    await scheduler.tick(now);
    assert.equal(store.hasDelivered(delivery), false);
    await scheduler.tick(now + 1000, true);
    await scheduler.tick(now + 6000);
    assert.equal(displays, 1);
    assert.equal(store.hasDelivered(delivery), true);
    scheduler.dispose();
    await new Scheduler(store, async () => { displays++; return { display: 'shown', audio: 'played' }; }).tick(now + 10000);
    assert.equal(displays, 1);
  } finally { scheduler?.dispose(); store.close(); }
});

test('persistent receipt failure does not repeat old cards or block a later reminder', async () => {
  const store = new Store(':memory:');
  let scheduler: Scheduler | undefined;
  try {
    store.save({ value }, now - 60000);
    store.save({ value: { ...value, title: 'Later reminder', startAt: '2026-09-20T15:01' } }, now - 60000);
    const ids = reminderCandidates(store.snapshot(), now - 1, now + 60000).map(r => r.id);
    const mark = store.markDelivered.bind(store);
    let storageAvailable = false, displays = 0;
    store.markDelivered = (ids, at) => { if (!storageAvailable) throw new Error('storage unavailable'); mark(ids, at); };
    scheduler = new Scheduler(store, async () => { displays++; return { display: 'shown', audio: 'played' }; });
    for (const offset of [0, 1000, 5000, 10000, 60000, 61000]) await scheduler.tick(now + offset);
    assert.equal(displays, 2);
    storageAvailable = true;
    await scheduler.tick(now + 66000);
    assert.ok(ids.every(id => store.hasDelivered(id)));
    assert.equal(displays, 2);
  } finally { scheduler?.dispose(); store.close(); }
});

test('clock rollback does not defer recovered receipt storage until the old clock catches up', async () => {
  const store = new Store(':memory:');
  let scheduler: Scheduler | undefined;
  try {
    store.save({ value }, now - 60000);
    const id = reminderCandidates(store.snapshot(), now - 1, now)[0].id;
    const mark = store.markDelivered.bind(store); let available = false;
    store.markDelivered = (ids, at) => { if (!available) throw new Error('storage unavailable'); mark(ids, at); };
    scheduler = new Scheduler(store, async () => ({ display: 'shown', audio: 'played' }));
    await scheduler.tick(now);
    available = true;
    await scheduler.tick(now - 3600000);
    assert.equal(store.hasDelivered(id), true);
  } finally { scheduler?.dispose(); store.close(); }
});

test('large retained history does not overflow the scheduler argument stack', () => {
  const past = { ...value, date: '2020-01-01', startAt: '2020-01-01T15:00', endAt: '2020-01-01T16:00',
    reminders: Array.from({ length: 20 }, (_, minutes) => ({ anchor: 'start' as const, minutes })), createdAt: 1, updatedAt: 1 };
  const snapshot: Snapshot = { items: Array.from({ length: 10000 }, (_, i) => ({ ...past, id: String(i) })), exceptions: [], states: [], presets: [], settings: { theme: 'light', locale: 'zh-TW', launchOnLogin: false, alwaysOnTop: false, defaultReminders: [] } };
  assert.deepEqual(reminderCandidates(snapshot, now - 1, now), []);
});
