import { reminderCandidates, type DueReminder } from '../src/shared/domain.js';
import { dateKey } from '../src/shared/time.js';
import type { Store } from './store.js';
import type { ReminderDeliveryResult } from '../src/shared/types.js';
import { localizedError } from '../src/shared/i18n.js';

export class Scheduler {
  private last: number | null = null;
  private pending = new Map<string, { reminder: DueReminder; missed: boolean; attempts: number; next: number }>();
  private running: Promise<void> | null = null;
  private resumeRequested = false;
  private stopped = false;
  // A displayed card must not be sent again just because its SQLite receipt failed.
  private unrecorded = new Set<string>();
  private recordAt = 0;
  private nextRecordRetry = 0;
  constructor(private readonly store: Store,
    private readonly notify: (reminders: DueReminder[], missed: boolean) => Promise<ReminderDeliveryResult>,
    private readonly onFailure: (message: string) => void = () => {}) {}
  tick(now = Date.now(), resume = false): Promise<void> {
    if (this.stopped) return Promise.resolve();
    if (this.running) { this.resumeRequested ||= resume; return this.running; }
    const catchup = resume || this.resumeRequested;
    this.resumeRequested = false;
    this.running = this.run(now, catchup).finally(() => { this.running = null; });
    return this.running;
  }
  dispose(): void { this.stopped = true; this.pending.clear(); }
  private async run(now: number, resume: boolean): Promise<void> {
    if (this.last !== null && now < this.last) this.nextRecordRetry = 0;
    this.persistReceipts(now);
    const catchup = resume || this.last === null || now - this.last > 60000;
    const midnight = +new Date(`${dateKey(new Date(now))}T00:00:00`) - 1;
    const from = catchup ? midnight : this.last!;
    const snapshot = this.store.snapshot();
    if (from < now) for (const reminder of reminderCandidates(snapshot, from, now)) {
      if (!this.unrecorded.has(reminder.id) && !this.store.hasDelivered(reminder.id) && !this.pending.has(reminder.id))
        this.pending.set(reminder.id, { reminder, missed: catchup, attempts: 0, next: now });
    }
    this.last = now;
    // Revalidate failed/queued reminders: completed, moved, deleted and past-day items cannot retry.
    const valid = new Set(reminderCandidates(snapshot, midnight, now).map(r => r.id));
    for (const id of this.pending.keys()) if (!valid.has(id) || this.unrecorded.has(id) || this.store.hasDelivered(id)) this.pending.delete(id);
    const batch = [...this.pending.values()].filter(p => p.attempts < 3 && p.next <= now);
    if (!batch.length) return;
    for (const p of batch) p.attempts++;
    let result: ReminderDeliveryResult;
    try { result = await this.notify(batch.map(p => p.reminder), batch.some(p => p.missed)); }
    catch (error) { result = { display: 'failed', audio: 'not-attempted', error: String(error) }; }
    if (this.stopped) return;
    if (result.display === 'shown') {
      if (!this.unrecorded.size) this.recordAt = now;
      for (const p of batch) { this.unrecorded.add(p.reminder.id); this.pending.delete(p.reminder.id); }
      this.persistReceipts(now);
      if (result.audio === 'failed') this.onFailure(localizedError('小卡已顯示，但提示音播放失敗：{detail}', { detail: result.error ?? '未知原因' }).message);
    } else {
      for (const p of batch) { if (result.display === 'cancelled') p.attempts--; p.next = now + (p.attempts <= 1 ? 2000 : 5000); }
      if (result.display === 'failed') this.onFailure(localizedError(batch.every(p => p.attempts >= 3) ? '提醒小卡顯示失敗（已重試 3 次）：{detail}' : '提醒小卡顯示失敗，將重試：{detail}', { detail: result.error ?? '未知原因' }).message);
    }
  }
  private persistReceipts(now: number): void {
    if (!this.unrecorded.size || now < this.nextRecordRetry) return;
    try {
      this.store.markDelivered([...this.unrecorded], this.recordAt);
      this.unrecorded.clear(); this.nextRecordRetry = 0;
    } catch (error) {
      this.nextRecordRetry = now + 5000;
      this.onFailure(localizedError('提醒已顯示，紀錄寫入失敗，將重試儲存而不重複顯示：{detail}', { detail: String(error) }).message);
    }
  }
}
