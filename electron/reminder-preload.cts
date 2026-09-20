import { contextBridge, ipcRenderer } from 'electron';
import type { ReminderCardBridge } from '../src/shared/types.js';
const bridge: ReminderCardBridge = {
  content: () => ipcRenderer.invoke('reminder-content'),
  ready: () => ipcRenderer.invoke('reminder-ready'),
  audioResult: (result, error) => ipcRenderer.invoke('reminder-audio', { result, error }),
  dismiss: () => ipcRenderer.invoke('reminder-dismiss'),
  open: key => ipcRenderer.invoke('reminder-open', key),
};
contextBridge.exposeInMainWorld('reminderCard', bridge);
