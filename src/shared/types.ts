export type Reminder = { anchor: 'start' | 'end'; minutes: number };
export type Repeat = { kind: 'none' | 'daily' | 'weekly'; weekdays: number[]; until: string | null };
export type ItemInput = {
  title: string; notes: string; date: string; startAt: string | null; endAt: string | null;
  repeat: Repeat; reminders: Reminder[];
};
export type Item = ItemInput & { id: string; createdAt: number; updatedAt: number };
export type Occurrence = ItemInput & {
  key: string; itemId: string; occurrenceDate: string; recurring: boolean;
  completedAt: number | null; notBefore: number;
};
export type OccurrenceState = { itemId: string; occurrenceDate: string; completedAt: number | null; notBefore: number };
export type Exception = { itemId: string; occurrenceDate: string; deleted: boolean; value: ItemInput | null; updatedAt: number };
export type Scope = 'single' | 'future';
export type SaveRequest = { value: ItemInput; target?: { itemId: string; occurrenceDate: string; scope: Scope } };
export type Target = { itemId: string; occurrenceDate: string };
export type ReminderCardItem = { key: string; title: string; time: string; endDate?: string; reason: string; target?: Target };
export type ReminderCardContent = { id: string; items: ReminderCardItem[]; missed: boolean; test: boolean };
export type ReminderDeliveryResult = { display: 'shown' | 'failed' | 'cancelled'; audio: 'played' | 'failed' | 'cancelled' | 'not-attempted'; error?: string };
export type ReminderCardBridge = {
  content(): Promise<ReminderCardContent>;
  ready(): Promise<boolean>;
  audioResult(result: 'played' | 'failed', error?: string): Promise<void>;
  dismiss(): Promise<void>;
  open(key?: string): Promise<void>;
};
export type Preset = { id: string; title: string };
export type Settings = { launchOnLogin: boolean; alwaysOnTop: boolean; defaultReminders: Reminder[] };
export type Snapshot = { items: Item[]; exceptions: Exception[]; states: OccurrenceState[]; presets: Preset[]; settings: Settings };
export type WindowMode = 'full' | 'mini';
export type WindowState = { mode: WindowMode; maximized: boolean };
export type AppEvent = { type: 'changed' } | { type: 'window'; value: WindowState } | { type: 'open'; target?: Target; date?: string } | { type: 'error'; message: string };
export type Bridge = {
  snapshot(): Promise<Snapshot>;
  save(request: SaveRequest): Promise<void>;
  remove(target: Target & { scope: Scope }): Promise<void>;
  complete(target: Target & { completed: boolean }): Promise<void>;
  savePresets(presets: Preset[]): Promise<void>;
  saveSettings(settings: Settings): Promise<void>;
  testNotification(): Promise<ReminderDeliveryResult>;
  windowState(): Promise<WindowState>;
  windowAction(action: 'mini' | 'full' | 'minimize' | 'maximize' | 'close'): Promise<void>;
  subscribe(callback: (event: AppEvent) => void): () => void;
};
