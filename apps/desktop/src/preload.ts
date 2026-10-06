import { Schema, Result } from 'effect';
import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import {
  desktopActionSchema,
  desktopAppUpdateCheckSchema,
  desktopAppUpdateStateSchema,
  desktopCredentialsSchema,
  type DesktopAppUpdateState,
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
const version =
  process.argv
    .find((argument) => argument.startsWith('--porcelain-version='))
    ?.slice('--porcelain-version='.length) ?? '';
let updateState: DesktopAppUpdateState = { status: 'idle' };
ipcRenderer.on(
  'porcelain:app-update-state',
  (_event: IpcRendererEvent, value: unknown) => {
    const parsed = Schema.decodeUnknownResult(desktopAppUpdateStateSchema)(
      value,
    );
    if (Result.isSuccess(parsed)) updateState = parsed.success;
  },
);
const bridge: DesktopBridge = {
  pickProjectFolder: async () => {
    const value: unknown = await ipcRenderer.invoke(
      'porcelain:pick-project-folder',
    );
    if (value !== null && typeof value !== 'string')
      throw new Error('Invalid project folder response');
    return value;
  },
  credentials: {
    read: async () => {
      const value: unknown = await ipcRenderer.invoke(
        'porcelain:credentials-read',
      );
      return Schema.decodeUnknownSync(desktopCredentialsSchema)(value);
    },
    write: async (value) => {
      if (typeof value !== 'string')
        throw new Error('Credentials must be a string');
      await ipcRenderer.invoke('porcelain:credentials-write', value);
    },
    clear: async () => {
      await ipcRenderer.invoke('porcelain:credentials-clear');
    },
  },
  appUpdate: {
    current: () => version,
    check: async () => {
      const value: unknown = await ipcRenderer.invoke(
        'porcelain:app-update-check',
      );
      return Schema.decodeUnknownSync(desktopAppUpdateCheckSchema)(value);
    },
    install: async () => {
      await ipcRenderer.invoke('porcelain:app-update-install');
    },
    onState: (receive) => {
      const listener = (_event: IpcRendererEvent, value: unknown) => {
        const parsed = Schema.decodeUnknownResult(desktopAppUpdateStateSchema)(
          value,
        );
        if (Result.isSuccess(parsed)) receive(parsed.success);
      };
      ipcRenderer.on('porcelain:app-update-state', listener);
      receive(updateState);
      ipcRenderer.send('porcelain:app-update-watch');
      return () =>
        ipcRenderer.removeListener('porcelain:app-update-state', listener);
    },
  },
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
      const parsed = Schema.decodeUnknownResult(desktopActionSchema)(value);
      if (Result.isSuccess(parsed)) receive(parsed.success);
    };
    ipcRenderer.on('porcelain:action', listener);
    ipcRenderer.send('porcelain:actions-ready');
    return () => ipcRenderer.removeListener('porcelain:action', listener);
  },
  setAppearance: (appearance) =>
    ipcRenderer.send('porcelain:appearance', appearance),
};
contextBridge.exposeInMainWorld('porcelainDesktop', bridge);
