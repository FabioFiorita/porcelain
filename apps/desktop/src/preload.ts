import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import {
  desktopActionSchema,
  type DesktopBridge,
} from '@porcelain/contracts/desktop';

let fullscreen = false;
ipcRenderer.on(
  'porcelain:fullscreen',
  (_event: IpcRendererEvent, value: unknown) => {
    if (typeof value === 'boolean') fullscreen = value;
  },
);
const liveAddress =
  process.argv
    .find((argument) => argument.startsWith('--porcelain-live='))
    ?.slice('--porcelain-live='.length) ?? '';
const bridge: DesktopBridge = {
  liveAddress: () => liveAddress,
  isFullscreen: () => fullscreen,
  onFullscreen: (receive) => {
    const listener = (_event: IpcRendererEvent, value: unknown) => {
      if (typeof value === 'boolean') receive(value);
    };
    ipcRenderer.on('porcelain:fullscreen', listener);
    return () => ipcRenderer.removeListener('porcelain:fullscreen', listener);
  },
  onAction: (receive) => {
    const listener = (_event: IpcRendererEvent, value: unknown) => {
      const parsed = desktopActionSchema.safeParse(value);
      if (parsed.success) receive(parsed.data);
    };
    ipcRenderer.on('porcelain:action', listener);
    ipcRenderer.send('porcelain:actions-ready');
    return () => ipcRenderer.removeListener('porcelain:action', listener);
  },
  setAppearance: (appearance) =>
    ipcRenderer.send('porcelain:appearance', appearance),
};
contextBridge.exposeInMainWorld('porcelainDesktop', bridge);
