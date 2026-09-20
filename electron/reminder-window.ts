import { BrowserWindow, ipcMain, screen, type IpcMainInvokeEvent } from 'electron';
import { join } from 'node:path';
import type { ReminderCardContent, ReminderDeliveryResult, Target } from '../src/shared/types.js';
import { rendererUrl, trustedRenderer } from './security.js';

type Request = { content: ReminderCardContent; relevant: () => boolean; resolve: (result: ReminderDeliveryResult) => void };
type Active = Request & { win: BrowserWindow; shown: boolean; settled: boolean; readyTimer?: NodeJS.Timeout; audioTimer?: NodeJS.Timeout; closeTimer?: NodeJS.Timeout };

/** Each card owns its renderer and audio. No dependency on the main window's visibility. */
export class ReminderWindows {
  private queue: Request[] = [];
  private active?: Active;
  private stopped = false;
  constructor(private readonly root: string, private readonly openTarget: (target?: Target) => void,
    private readonly audit: (content: ReminderCardContent, result: ReminderDeliveryResult) => void, private readonly devUrl?: string) {
    const handle = (name: string, action: (active: Active, value: any) => unknown) => ipcMain.handle(name, (event: IpcMainInvokeEvent, value) => {
      const active = this.active;
      if (!active || event.sender !== active.win.webContents || event.senderFrame !== active.win.webContents.mainFrame || !trustedRenderer(event.senderFrame?.url, join(this.root, 'dist'), this.devUrl, true)) throw new Error('無效的提醒視窗呼叫。');
      return action(active, value);
    });
    handle('reminder-content', a => a.content);
    handle('reminder-ready', a => {
      if (a.shown) return false;
      try {
        if (!a.relevant()) { this.settle(a, { display: 'cancelled', audio: 'not-attempted' }); a.win.destroy(); return false; }
        clearTimeout(a.readyTimer);
        a.win.showInactive();
        if (!a.win.isVisible()) throw new Error('提醒視窗未能顯示。');
        a.shown = true;
        a.closeTimer = setTimeout(() => a.win.destroy(), 10000);
        a.audioTimer = setTimeout(() => this.settle(a, { display: 'shown', audio: 'failed', error: '音效播放逾時。' }), 5000);
        return true;
      } catch (error) { this.fail(a, error); return false; }
    });
    handle('reminder-audio', (a, value) => {
      if (!a.shown || !value || !['played', 'failed'].includes(value.result) || (value.error !== undefined && typeof value.error !== 'string')) throw new Error('無效的音效結果。');
      this.settle(a, { display: 'shown', audio: value.result, error: value.error?.slice(0, 500) });
    });
    handle('reminder-dismiss', a => { a.win.close(); });
    handle('reminder-open', (a, key) => {
      if (key !== undefined && (typeof key !== 'string' || !a.content.items.some(i => i.key === key))) throw new Error('無效的提醒事項。');
      this.openTarget(a.content.items.find(i => i.key === key)?.target);
      a.win.close();
    });
  }
  show(content: ReminderCardContent, relevant: () => boolean = () => true): Promise<ReminderDeliveryResult> {
    if (this.stopped) return Promise.resolve({ display: 'cancelled', audio: 'not-attempted' });
    return new Promise(resolve => { this.queue.push({ content, relevant, resolve }); this.next(); });
  }
  dispose(): void {
    this.stopped = true;
    for (const request of this.queue.splice(0)) request.resolve({ display: 'cancelled', audio: 'not-attempted' });
    if (this.active) {
      this.settle(this.active, { display: this.active.shown ? 'shown' : 'cancelled', audio: 'cancelled' });
      this.active.win.destroy();
    }
  }
  private settle(a: Active, result: ReminderDeliveryResult): void {
    if (a.settled) return;
    a.settled = true;
    clearTimeout(a.readyTimer); clearTimeout(a.audioTimer);
    try { this.audit(a.content, result); } finally { a.resolve(result); }
  }
  private fail(a: Active, error: unknown): void {
    this.settle(a, { display: a.shown ? 'shown' : 'failed', audio: a.shown ? 'failed' : 'not-attempted', error: String(error) });
    if (!a.win.isDestroyed()) a.win.destroy();
  }
  private next(): void {
    if (this.stopped || this.active) return;
    const request = this.queue.shift();
    if (!request) return;
    let created: BrowserWindow | undefined;
    try {
      const area = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea;
      const width = Math.min(380, area.width - 24), height = Math.min(120 + Math.min(3, request.content.items.length) * 84, area.height - 24);
      const win = created = new BrowserWindow({ width, height, x: area.x + area.width - width - 12, y: area.y + area.height - height - 12,
        show: false, frame: false, focusable: false, skipTaskbar: true, alwaysOnTop: true, resizable: false, movable: false,
        minimizable: false, maximizable: false, fullscreenable: false, backgroundColor: '#fffdf9', title: '日序提醒', icon: join(this.root, 'assets/icon.png'),
        webPreferences: { preload: join(this.root, 'dist-electron/electron/reminder-preload.cjs'), contextIsolation: true, nodeIntegration: false,
          sandbox: true, backgroundThrottling: false, autoplayPolicy: 'no-user-gesture-required' } });
      const a: Active = { ...request, win, shown: false, settled: false };
      this.active = a;
      win.setMenu(null);
      win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
      win.webContents.on('will-navigate', e => e.preventDefault());
      win.webContents.on('will-frame-navigate', e => e.preventDefault());
      win.webContents.on('will-attach-webview', e => e.preventDefault());
      win.webContents.on('render-process-gone', (_event, details) => this.fail(a, `提醒視窗中斷：${details.reason}`));
      win.on('closed', () => {
        clearTimeout(a.readyTimer); clearTimeout(a.audioTimer); clearTimeout(a.closeTimer);
        if (!a.settled) this.settle(a, { display: a.shown ? 'shown' : 'failed', audio: a.shown ? 'cancelled' : 'not-attempted', error: a.shown ? undefined : '提醒視窗在顯示前關閉。' });
        if (this.active === a) this.active = undefined;
        this.next();
      });
      a.readyTimer = setTimeout(() => this.fail(a, '提醒視窗載入逾時。'), 8000);
      const loaded = win.loadURL(rendererUrl(join(this.root, 'dist'), this.devUrl, true));
      void loaded.catch(error => this.fail(a, error));
    } catch (error) {
      if (this.active && this.active.win === created) this.fail(this.active, error);
      else {
        created?.destroy();
        const result: ReminderDeliveryResult = { display: 'failed', audio: 'not-attempted', error: String(error) };
        try { this.audit(request.content, result); } finally { request.resolve(result); this.next(); }
      }
    }
  }
}
