import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { Exception, Item, ItemInput, Occurrence, OccurrenceState, Preset, SaveRequest, Settings, Snapshot, Target } from '../src/shared/types.js';
import { DEFAULT_REMINDERS, makeOccurrence, occursOn, PRESET_TITLES, validateInput, validateReminders } from '../src/shared/domain.js';
import { addDays, dayDifference, validDate } from '../src/shared/time.js';

export class Store {
  readonly db: DatabaseSync;
  constructor(path: string) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS items (id TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS exceptions (itemId TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE, occurrenceDate TEXT NOT NULL, value TEXT NOT NULL, PRIMARY KEY(itemId, occurrenceDate));
      CREATE TABLE IF NOT EXISTS states (itemId TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE, occurrenceDate TEXT NOT NULL, value TEXT NOT NULL, PRIMARY KEY(itemId, occurrenceDate));
      CREATE TABLE IF NOT EXISTS deliveries (id TEXT PRIMARY KEY, at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      PRAGMA user_version=1;`);
    if (!this.getMeta('settings')) this.setMeta('settings', { launchOnLogin: true, alwaysOnTop: false, defaultReminders: DEFAULT_REMINDERS });
    if (!this.getMeta('presets')) this.setMeta('presets', PRESET_TITLES.map(title => ({ id: randomUUID(), title })));
  }
  close(): void { this.db.close(); }
  getMeta<T>(key: string): T | undefined {
    const row = this.db.prepare('SELECT value FROM meta WHERE key=?').get(key);
    return row ? JSON.parse(String(row.value)) as T : undefined;
  }
  setMeta(key: string, value: unknown): void { this.db.prepare('INSERT OR REPLACE INTO meta(key,value) VALUES (?,?)').run(key, JSON.stringify(value)); }
  private list<T>(table: 'items' | 'exceptions' | 'states'): T[] { return this.db.prepare(`SELECT value FROM ${table}`).all().map(row => JSON.parse(String(row.value)) as T); }
  snapshot(): Snapshot {
    return { items: this.list<Item>('items'), exceptions: this.list<Exception>('exceptions'), states: this.list<OccurrenceState>('states'), presets: this.getMeta<Preset[]>('presets')!, settings: this.getMeta<Settings>('settings')! };
  }
  private transaction<T>(action: () => T): T { this.db.exec('BEGIN IMMEDIATE'); try { const result = action(); this.db.exec('COMMIT'); return result; } catch (e) { this.db.exec('ROLLBACK'); throw e; } }
  private putItem(item: Item): void { this.db.prepare('INSERT INTO items(id,value) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value').run(item.id, JSON.stringify(item)); }
  private putException(ex: Exception): void { this.db.prepare('INSERT OR REPLACE INTO exceptions(itemId,occurrenceDate,value) VALUES(?,?,?)').run(ex.itemId, ex.occurrenceDate, JSON.stringify(ex)); }
  private putState(state: OccurrenceState): void { this.db.prepare('INSERT OR REPLACE INTO states(itemId,occurrenceDate,value) VALUES(?,?,?)').run(state.itemId, state.occurrenceDate, JSON.stringify(state)); }
  getOccurrence(target: Target): Occurrence {
    this.validateTarget(target);
    const snapshot = this.snapshot(), item = snapshot.items.find(i => i.id === target.itemId);
    const ex = snapshot.exceptions.find(e => e.itemId === target.itemId && e.occurrenceDate === target.occurrenceDate);
    if (!item || !occursOn(item, target.occurrenceDate) || ex?.deleted) throw new Error('找不到這筆行程，請重新開啟。');
    return makeOccurrence(item, target.occurrenceDate, ex, snapshot.states.find(s => s.itemId === target.itemId && s.occurrenceDate === target.occurrenceDate));
  }
  private validateTarget(target: Target): void { if (!target || typeof target.itemId !== 'string' || !validDate(target.occurrenceDate)) throw new Error('行程識別資料不正確。'); }
  save(request: SaveRequest, now = Date.now()): string {
    if (!request || typeof request !== 'object') throw new Error('行程資料不正確。');
    const target = request.target;
    if (target && !['single', 'future'].includes(target.scope)) throw new Error('請選擇修改範圍。');
    const original = target ? this.getOccurrence(target) : undefined;
    const raw = target?.scope === 'single' && original?.recurring ? { ...request.value, repeat: { kind: 'none', weekdays: [], until: null } } : request.value;
    const value = validateInput(raw);
    return this.transaction(() => {
      if (!target) {
        const item: Item = { ...value, id: randomUUID(), createdAt: now, updatedAt: now };
        this.putItem(item); return item.id;
      }
      const item = this.snapshot().items.find(i => i.id === target.itemId)!;
      if (item.repeat.kind === 'none') {
        const state = this.snapshot().states.find(s => s.itemId === item.id && s.occurrenceDate === item.date);
        this.db.prepare('DELETE FROM states WHERE itemId=?').run(item.id);
        this.db.prepare('DELETE FROM exceptions WHERE itemId=?').run(item.id);
        this.putItem({ ...item, ...value, updatedAt: now });
        if (state) this.putState({ ...state, occurrenceDate: value.date, notBefore: now });
        return item.id;
      }
      if (target.scope === 'single') {
        this.putException({ itemId: item.id, occurrenceDate: target.occurrenceDate, deleted: false, value, updatedAt: now });
        return item.id;
      }
      const futureStates = this.snapshot().states.filter(s => s.itemId === item.id && s.occurrenceDate >= target.occurrenceDate);
      this.truncate(item, target.occurrenceDate);
      const next: Item = { ...value, id: randomUUID(), createdAt: now, updatedAt: now };
      this.putItem(next);
      // Preserve completion on matching dates when changing the future series.
      const delta = dayDifference(value.date, target.occurrenceDate);
      for (const state of futureStates) {
        const date = addDays(state.occurrenceDate, delta);
        if (occursOn(next, date)) this.putState({ ...state, itemId: next.id, occurrenceDate: date, notBefore: now });
      }
      return next.id;
    });
  }
  private truncate(item: Item, date: string): void {
    if (date <= item.date) this.db.prepare('DELETE FROM items WHERE id=?').run(item.id);
    else {
      this.putItem({ ...item, repeat: { ...item.repeat, until: addDays(date, -1) } });
      this.db.prepare('DELETE FROM exceptions WHERE itemId=? AND occurrenceDate>=?').run(item.id, date);
      this.db.prepare('DELETE FROM states WHERE itemId=? AND occurrenceDate>=?').run(item.id, date);
    }
  }
  remove(target: Target & { scope: 'single' | 'future' }, now = Date.now()): void {
    if (!target || !['single', 'future'].includes(target.scope)) throw new Error('請選擇刪除範圍。');
    this.getOccurrence(target);
    this.transaction(() => {
      const item = this.snapshot().items.find(i => i.id === target.itemId)!;
      if (item.repeat.kind === 'none') this.db.prepare('DELETE FROM items WHERE id=?').run(item.id);
      else if (target.scope === 'future') this.truncate(item, target.occurrenceDate);
      else this.putException({ ...target, deleted: true, value: null, updatedAt: now });
    });
  }
  complete(target: Target & { completed: boolean }, now = Date.now()): void {
    this.getOccurrence(target);
    if (typeof target.completed !== 'boolean') throw new Error('完成狀態不正確。');
    this.putState({ itemId: target.itemId, occurrenceDate: target.occurrenceDate, completedAt: target.completed ? now : null, notBefore: now });
  }
  savePresets(value: unknown): void {
    if (!Array.isArray(value) || value.length > 500) throw new Error('常用事項最多可設定 500 筆。');
    const ids = new Set<string>();
    const presets = value.map(p => {
      if (!p || typeof p.id !== 'string' || p.id.length > 100 || ids.has(p.id) || typeof p.title !== 'string' || !p.title.trim() || p.title.length > 200) throw new Error('請檢查常用事項名稱。');
      ids.add(p.id); return { id: p.id, title: p.title.trim() };
    });
    this.setMeta('presets', presets);
  }
  saveSettings(value: unknown): void {
    const s = value as Settings;
    if (!s || typeof s.launchOnLogin !== 'boolean' || typeof s.alwaysOnTop !== 'boolean') throw new Error('設定格式不正確。');
    this.setMeta('settings', { launchOnLogin: s.launchOnLogin, alwaysOnTop: s.alwaysOnTop, defaultReminders: validateReminders(s.defaultReminders) });
  }
  hasDelivered(id: string): boolean { return !!this.db.prepare('SELECT id FROM deliveries WHERE id=?').get(id); }
  markDelivered(ids: string[], now: number): void { this.transaction(() => { const stmt = this.db.prepare('INSERT OR IGNORE INTO deliveries(id,at) VALUES(?,?)'); for (const id of ids) stmt.run(id, now); }); }
}
