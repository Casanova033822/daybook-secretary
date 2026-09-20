import { app, BrowserWindow, dialog, ipcMain, Menu, nativeImage, powerMonitor, protocol, screen, Tray } from 'electron';
import { randomUUID } from 'node:crypto';
import { dirname, extname, isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { appendFileSync, readFileSync } from 'node:fs';
import type { AppEvent, ReminderCardContent, ReminderDeliveryResult, Settings, Target, WindowMode } from '../src/shared/types.js';
import { clock, dateKey } from '../src/shared/time.js';
import { reminderCandidates, type DueReminder } from '../src/shared/domain.js';
import { Store } from './store.js';
import { Scheduler } from './scheduler.js';
import { ReminderWindows } from './reminder-window.js';
import { allowedRequest, bundledPath, developmentUrl, rendererUrl, trustedRenderer } from './security.js';

const APP_ID = 'tw.daybook.secretary';
protocol.registerSchemesAsPrivileged([{ scheme: 'daybook', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }]);
const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const dist = join(root, 'dist');
const devUrl = developmentUrl(app.isPackaged, process.env.VITE_DEV_SERVER_URL);
const testMode = process.env.DAYBOOK_TEST === '1' && !!process.env.DAYBOOK_DATA_DIR && isAbsolute(process.env.DAYBOOK_DATA_DIR);
if (testMode && process.env.DAYBOOK_DATA_DIR) app.setPath('userData', process.env.DAYBOOK_DATA_DIR);
app.setName('日序');
app.setAppUserModelId(APP_ID);
let store: Store, win: BrowserWindow, tray: Tray, scheduler: Scheduler;
let reminderWindows: ReminderWindows;
let mode: WindowMode = 'full', quitting = false, switching = false;
let interval: ReturnType<typeof setInterval>;
let geometryTimer: ReturnType<typeof setTimeout>;
function emit(event: AppEvent): void { if (win && !win.isDestroyed()) win.webContents.send('app-event', event); }
function log(error: unknown): void { try { appendFileSync(join(app.getPath('userData'), 'app.log'), `${new Date().toISOString()} ${String(error)}\n`); } catch { /* no writable log */ } }
function report(error: unknown): void { log(error); emit({ type: 'error', message: error instanceof Error ? error.message : String(error) }); }
function persistWindowMeta(key: string, value: unknown): void {
  try { store.setMeta(key, value); }
  catch (error) { if (quitting) log(error); else report(error); }
}
function windowState() { return { mode, maximized: win?.isMaximized() ?? false }; }
function notifyState(): void { emit({ type: 'window', value: windowState() }); }
function fitBounds(bounds: Electron.Rectangle): Electron.Rectangle {
  const area = screen.getDisplayMatching(bounds).workArea;
  const width = Math.min(bounds.width, area.width), height = Math.min(bounds.height, area.height);
  return { width, height, x: Math.max(area.x, Math.min(bounds.x, area.x + area.width - width)), y: Math.max(area.y, Math.min(bounds.y, area.y + area.height - height)) };
}
function saveBounds(): void {
  if (!win || win.isDestroyed() || switching || win.isMinimized()) return;
  persistWindowMeta(`bounds-${mode}`, win.getNormalBounds());
}
function switchMode(next: WindowMode, show = true): void {
  if (mode !== next) {
    saveBounds(); switching = true;
    if (win.isMaximized()) win.unmaximize();
    mode = next;
    win.setMinimumSize(next === 'mini' ? 330 : 850, next === 'mini' ? 300 : 600);
    const previous = store.getMeta<Electron.Rectangle>(`bounds-${next}`);
    const current = win.getBounds();
    win.setBounds(fitBounds(previous ?? { x: current.x, y: current.y, width: next === 'mini' ? 390 : 1180, height: next === 'mini' ? 600 : 820 }));
    switching = false;
    persistWindowMeta('last-mode', mode);
  }
  notifyState();
  if (show) { win.show(); if (win.isMinimized()) win.restore(); win.focus(); }
}
function notifyDue(due: DueReminder[], missed: boolean): Promise<ReminderDeliveryResult> {
  const groups = new Map<string, DueReminder[]>();
  for (const r of due) { const list = groups.get(r.occurrence.key) ?? []; list.push(r); groups.set(r.occurrence.key, list); }
  const content: ReminderCardContent = { id: randomUUID(), missed, test: false, items: [...groups.values()].map(list => {
    const o = list[0].occurrence;
    return { key: o.key, title: o.title, time: `${clock(o.startAt!)} - ${clock(o.endAt!)}`,
      endDate: o.startAt!.slice(0, 10) !== o.endAt!.slice(0, 10) ? o.endAt!.slice(0, 10) : undefined,
      reason: list.map(r => `${r.rule.anchor === 'start' ? '開始' : '結束'}${r.rule.minutes ? `前 ${r.rule.minutes} 分鐘` : '當下'}`).join(' · '),
      target: { itemId: o.itemId, occurrenceDate: o.occurrenceDate } };
  }) };
  return reminderWindows.show(content, () => {
    const valid = new Set(reminderCandidates(store.snapshot(), +new Date(`${dateKey()}T00:00:00`) - 1, Date.now()).map(r => r.id));
    return due.every(r => valid.has(r.id));
  });
}
function applySettings(settings: Settings): void {
  win.setAlwaysOnTop(settings.alwaysOnTop);
  if (app.isPackaged && !testMode) app.setLoginItemSettings({ openAtLogin: settings.launchOnLogin, path: process.execPath, args: ['--background'] });
}
function createWindow(): void {
  mode = store.getMeta<WindowMode>('last-mode') === 'mini' ? 'mini' : 'full';
  const area = screen.getPrimaryDisplay().workArea;
  const bounds = fitBounds(store.getMeta<Electron.Rectangle>(`bounds-${mode}`) ?? { x: area.x + Math.max(0, Math.round((area.width - 1180) / 2)), y: area.y + 40, width: mode === 'mini' ? 390 : 1180, height: mode === 'mini' ? 600 : 820 });
  win = new BrowserWindow({ ...bounds, minWidth: mode === 'mini' ? 330 : 850, minHeight: mode === 'mini' ? 300 : 600, show: false,
    frame: false, backgroundColor: '#f6f7fb', title: '日序 · 私人秘書', icon: join(root, 'assets/icon.png'),
    webPreferences: { preload: join(dirname(fileURLToPath(import.meta.url)), 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
  win.setMenu(null);
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', event => event.preventDefault());
  win.webContents.on('will-frame-navigate', event => event.preventDefault());
  win.webContents.on('will-attach-webview', event => event.preventDefault());
  win.webContents.session.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  win.webContents.session.setPermissionCheckHandler(() => false);
  win.webContents.session.webRequest.onBeforeRequest((details, callback) => callback({ cancel: !allowedRequest(details.url, dist, devUrl) }));
  win.on('close', event => { if (!quitting) { event.preventDefault(); saveBounds(); win.hide(); } });
  const geometry = () => { clearTimeout(geometryTimer); geometryTimer = setTimeout(saveBounds, 250); };
  win.on('move', geometry); win.on('resize', geometry);
  win.on('maximize', notifyState); win.on('unmaximize', notifyState);
  win.once('ready-to-show', () => { if (!process.argv.includes('--background') && !testMode) win.show(); });
  void win.loadURL(rendererUrl(dist, devUrl)).catch(report);
  applySettings(store.snapshot().settings);
}
function setupIpc(): void {
  const handle = (channel: string, action: (value: any) => unknown) => ipcMain.handle(channel, (event, value) => {
    if (event.sender !== win.webContents || event.senderFrame !== win.webContents.mainFrame || !trustedRenderer(event.senderFrame?.url, dist, devUrl)) throw new Error('無效的程式呼叫。');
    return action(value);
  });
  const mutate = (action: () => void) => { action(); emit({ type: 'changed' }); };
  handle('snapshot', () => store.snapshot());
  handle('save', value => mutate(() => { store.save(value); }));
  handle('remove', value => mutate(() => store.remove(value)));
  handle('complete', value => mutate(() => store.complete(value)));
  handle('presets', value => mutate(() => store.savePresets(value)));
  handle('settings', value => mutate(() => { const previous = store.snapshot().settings; store.saveSettings(value); try { applySettings(store.snapshot().settings); } catch (e) { store.saveSettings(previous); throw e; } }));
  handle('test-notification', () => reminderWindows.show({ id: randomUUID(), missed: false, test: true,
    items: [{ key: 'test', title: '提醒已準備好', time: new Intl.DateTimeFormat('zh-TW', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date()), reason: '日序小卡＋提示音測試' }] }));
  handle('window-state', windowState);
  handle('window-action', action => {
    if (action === 'full' || action === 'mini') switchMode(action);
    else if (action === 'minimize') win.minimize();
    else if (action === 'maximize') win.isMaximized() ? win.unmaximize() : win.maximize();
    else if (action === 'close') win.close();
    else throw new Error('無效的視窗操作。');
  });
}
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (win) switchMode(mode); });
  app.on('before-quit', () => { quitting = true; saveBounds(); clearInterval(interval); clearTimeout(geometryTimer); scheduler?.dispose(); reminderWindows?.dispose(); });
  app.on('will-quit', () => { store?.close(); });
  app.on('window-all-closed', () => { /* Tray owns app lifetime. */ });
  void app.whenReady().then(() => {
    protocol.handle('daybook', request => {
      const path = bundledPath(request.url, dist);
      if (request.method !== 'GET' || !path) return new Response('Not found', { status: 404 });
      const mime: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.wav': 'audio/wav' };
      try { return new Response(new Uint8Array(readFileSync(path)), { headers: { 'Content-Type': mime[extname(path)], 'X-Content-Type-Options': 'nosniff' } }); }
      catch { return new Response('Not found', { status: 404 }); }
    });
    store = new Store(join(app.getPath('userData'), 'daybook.sqlite'));
    reminderWindows = new ReminderWindows(root, (target?: Target) => { switchMode('full'); emit({ type: 'open', target, date: dateKey() }); }, (content, result) => {
      const entry = { at: Date.now(), id: content.id, test: content.test, missed: content.missed, count: content.items.length, ...result };
      try {
        store.setMeta('last-reminder-result', entry);
        if (testMode) store.setMeta('test-notifications', [...(store.getMeta<unknown[]>('test-notifications') ?? []), entry]);
        if (result.display === 'failed' || result.audio === 'failed') log(JSON.stringify(entry));
      } catch (error) { log(error); }
    }, devUrl);
    createWindow(); setupIpc();
    tray = new Tray(nativeImage.createFromPath(join(root, 'assets/icon.png')).resize({ width: 20, height: 20 }));
    tray.setToolTip('日序 · 私人秘書');
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: '開啟日序', click: () => switchMode('full') }, { label: '迷你視窗', click: () => switchMode('mini') },
      { type: 'separator' }, { label: '完全結束（停止提醒）', click: () => { app.quit(); } },
    ]));
    tray.on('double-click', () => switchMode(mode));
    scheduler = new Scheduler(store, notifyDue, log);
    const tick = (resume = false) => { void scheduler.tick(Date.now(), resume).catch(report); };
    interval = setInterval(() => tick(), 1000);
    tick(true);
    powerMonitor.on('resume', () => tick(true));
    powerMonitor.on('unlock-screen', () => tick(true));
    screen.on('display-removed', () => { if (win && !win.isDestroyed()) win.setBounds(fitBounds(win.getBounds())); });
  }).catch(error => { log(error); if (!testMode) dialog.showErrorBox('日序無法啟動', `請檢查資料夾是否可寫入，或查看日序資料夾中的 app.log。\n\n${String(error)}`); app.quit(); });
}
