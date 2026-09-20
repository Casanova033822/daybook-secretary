import { contextBridge, ipcRenderer } from 'electron';
import type { AppEvent, Bridge } from '../src/shared/types.js';
const bridge: Bridge = {
  snapshot: () => ipcRenderer.invoke('snapshot'),
  save: value => ipcRenderer.invoke('save', value),
  remove: value => ipcRenderer.invoke('remove', value),
  complete: value => ipcRenderer.invoke('complete', value),
  savePresets: value => ipcRenderer.invoke('presets', value),
  saveSettings: value => ipcRenderer.invoke('settings', value),
  testNotification: () => ipcRenderer.invoke('test-notification'),
  windowState: () => ipcRenderer.invoke('window-state'),
  windowAction: action => ipcRenderer.invoke('window-action', action),
  subscribe: callback => {
    const listener = (_event: Electron.IpcRendererEvent, value: AppEvent) => callback(value);
    ipcRenderer.on('app-event', listener);
    return () => { ipcRenderer.removeListener('app-event', listener); };
  },
};
contextBridge.exposeInMainWorld('daybook', bridge);
