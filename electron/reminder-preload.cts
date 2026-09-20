import { contextBridge, ipcRenderer } from 'electron';
import type { ReminderCardBridge } from '../src/shared/types.js';
const bridge: ReminderCardBridge = {
  appearance: () => ipcRenderer.invoke('reminder-appearance'),
  subscribeAppearance: callback => {
    const listener = (_event: Electron.IpcRendererEvent, value: Parameters<typeof callback>[0]) => callback(value);
    ipcRenderer.on('appearance-changed', listener);
    return () => ipcRenderer.removeListener('appearance-changed', listener);
  },
  content: () => ipcRenderer.invoke('reminder-content'),
  ready: () => ipcRenderer.invoke('reminder-ready'),
  audioResult: (result, error) => ipcRenderer.invoke('reminder-audio', { result, error }),
  dismiss: () => ipcRenderer.invoke('reminder-dismiss'),
  open: key => ipcRenderer.invoke('reminder-open', key),
};
contextBridge.exposeInMainWorld('reminderCard', bridge);
