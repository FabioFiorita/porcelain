import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  nativeTheme,
  screen,
  safeStorage,
  session,
  shell,
  type IpcMainEvent,
  type IpcMainInvokeEvent,
} from 'electron';
import { join } from 'node:path';
import {
  desktopAppearanceSchema,
  type DesktopAction,
} from '@porcelain/contracts/desktop';
import { WindowState } from './adapters/window-state.ts';
import { EncryptedCredentials } from './adapters/encrypted-credentials.ts';
import { LocalAppUpdate } from './local-app-update.ts';
import { restoreWindowBounds } from './rules/window-bounds.ts';
import { registerDesktopScheme, serveDesktop } from './app-protocol.ts';
import fixPath from 'fix-path';
import { desktopSettings } from './settings.ts';
import { startLocalServer } from './server-host.ts';
import {
  appDocument,
  desktopAddress,
  externalNavigation,
} from './rules/navigation.ts';
import { liveAddress, liveSocketHeaders } from './rules/live-socket.ts';
import { trustedSender } from './rules/trusted-sender.ts';

registerDesktopScheme();
app.setAppLogsPath(
  process.platform === 'darwin'
    ? join(app.getPath('home'), 'Library/Logs', app.getName())
    : undefined,
);
const settings = desktopSettings(
  app.getPath('userData'),
  app.getPath('logs'),
  app.getAppPath(),
  app.isPackaged,
);
app.setPath('userData', settings.profile);
let server: Awaited<ReturnType<typeof startLocalServer>> | undefined;
let window: BrowserWindow | undefined;
let quitting = false;
let closed = false;
let actionsReady = false;
let pendingAction: DesktopAction | undefined;
let stopServing: (() => void) | undefined;
const savedWindow = new WindowState(
  settings.profile,
  settings.limits.desktop.windowStateSaveMs,
);
const credentials = new EncryptedCredentials(settings.profile, {
  available: async () =>
    (await safeStorage.isAsyncEncryptionAvailable()) &&
    (process.platform !== 'linux' ||
      safeStorage.getSelectedStorageBackend() !== 'basic_text'),
  encrypt: (value) => safeStorage.encryptStringAsync(value),
  decrypt: async (value) => {
    const decrypted = await safeStorage.decryptStringAsync(value);
    return {
      value: decrypted.result,
      reEncrypt: decrypted.shouldReEncrypt,
    };
  },
});
const appUpdate = new LocalAppUpdate((state) =>
  window?.webContents.send('porcelain:app-update-state', state),
);

function trusted(event: IpcMainEvent | IpcMainInvokeEvent): boolean {
  return trustedSender(
    {
      contents: event.sender,
      frame: event.senderFrame,
      url: event.senderFrame?.url,
    },
    window && {
      contents: window.webContents,
      mainFrame: window.webContents.mainFrame,
    },
  );
}

function authorize(event: IpcMainInvokeEvent): void {
  if (!trusted(event)) throw new Error('Untrusted desktop request');
}

function windowBackground(): string {
  return nativeTheme.shouldUseDarkColors ? '#171717' : '#fafafa';
}

function windowState(view: BrowserWindow) {
  return { bounds: view.getNormalBounds(), maximized: view.isMaximized() };
}

function openExternal(url: string): void {
  if (externalNavigation(url))
    void shell.openExternal(url).catch((error: unknown) => {
      process.stderr.write(
        `Porcelain: could not open ${url}: ${error instanceof Error ? error.message : 'unknown failure'}\n`,
      );
    });
}

function failure(error: unknown) {
  process.stderr.write(
    `${error instanceof Error ? error.message : 'The local server failed'}\n`,
  );
  dialog.showErrorBox(
    'Porcelain could not continue',
    error instanceof Error ? error.message : 'The local server failed',
  );
  app.quit();
}

async function openWindow() {
  const local = server;
  if (local === undefined || quitting) return;
  if (window !== undefined) {
    if (window.isMinimized()) window.restore();
    window.show();
    window.focus();
    return;
  }
  const restored = restoreWindowBounds(
    savedWindow.read(),
    screen.getAllDisplays().map((display) => display.workArea),
    {
      width: settings.limits.desktop.minWidth,
      height: settings.limits.desktop.minHeight,
    },
  );
  const view = new BrowserWindow({
    width: settings.limits.desktop.windowWidth,
    height: settings.limits.desktop.windowHeight,
    minWidth: settings.limits.desktop.minWidth,
    minHeight: settings.limits.desktop.minHeight,
    ...(restored?.bounds ?? {}),
    title: 'Porcelain',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 24 },
    backgroundColor: windowBackground(),
    show: false,
    webPreferences: {
      preload: join(settings.packageRoot, 'desktop/preload.cjs'),
      additionalArguments: [
        `--porcelain-version=${app.getVersion()}`,
        `--porcelain-live=${liveAddress(local.address)}`,
      ],
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
    },
  });
  window = view;
  actionsReady = false;
  view.webContents.on(
    'did-start-navigation',
    (_event, _url, inPlace, mainFrame) => {
      if (mainFrame && !inPlace) actionsReady = false;
    },
  );
  const save = () => {
    if (!view.isDestroyed() && !view.isFullScreen())
      savedWindow.schedule(windowState(view));
  };
  view.on('close', () => {
    save();
    void savedWindow.flush();
  });
  view.on('resize', save);
  view.on('move', save);
  view.on('maximize', save);
  view.on('unmaximize', save);
  const fullscreen = () => {
    if (!view.isDestroyed())
      view.webContents.send('porcelain:fullscreen', view.isFullScreen());
  };
  view.on('enter-full-screen', fullscreen);
  view.on('leave-full-screen', fullscreen);
  view.webContents.on('did-finish-load', fullscreen);
  if (restored?.maximized) view.maximize();
  view.once('closed', () => {
    view.removeAllListeners();
    window = undefined;
    actionsReady = false;
  });
  view.once('ready-to-show', () => {
    if (!quitting && !view.isDestroyed()) view.show();
  });
  view.webContents.session.setPermissionRequestHandler(
    (_contents, _permission, callback) => callback(false),
  );
  view.webContents.session.setPermissionCheckHandler(() => false);
  view.webContents.on('will-attach-webview', (event) => event.preventDefault());
  view.webContents.on('will-navigate', (event, url) => {
    if (appDocument(url)) return;
    event.preventDefault();
    openExternal(url);
  });
  view.webContents.on('will-redirect', (event, url) => {
    if (!appDocument(url)) event.preventDefault();
  });
  view.webContents.on('context-menu', (_event, params) => {
    if (params.isEditable)
      Menu.buildFromTemplate([
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ]).popup({ window: view });
    else if (params.selectionText)
      Menu.buildFromTemplate([{ role: 'copy' }, { role: 'selectAll' }]).popup({
        window: view,
      });
  });
  view.webContents.setWindowOpenHandler(({ url }) => {
    openExternal(url);
    return { action: 'deny' };
  });
  await view.loadURL(desktopAddress);
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
app.on('activate', () => {
  void openWindow().catch(failure);
});
app.on('second-instance', () => {
  void openWindow().catch(failure);
});
app.on('before-quit', (event) => {
  if (closed) return;
  event.preventDefault();
  if (quitting) return;
  quitting = true;
  stopServing?.();
  process.stderr.write('Porcelain: stopping server\n');
  for (const view of BrowserWindow.getAllWindows()) {
    if (!view.isFullScreen()) savedWindow.schedule(windowState(view));
    view.destroy();
  }
  void Promise.all([savedWindow.flush(), server?.close()])
    .catch((error: unknown) => {
      process.stderr.write(
        `${error instanceof Error ? error.message : 'Server shutdown failed'}\n`,
      );
    })
    .finally(() => {
      closed = true;
      process.stderr.write('Porcelain: server stopped, exiting app\n');
      app.quit();
    });
});

async function dispatch(action: DesktopAction) {
  try {
    await openWindow();
    if (actionsReady) window?.webContents.send('porcelain:action', action);
    else pendingAction = action;
  } catch (error) {
    failure(error);
  }
}

async function start() {
  await app.whenReady();
  ipcMain.handle('porcelain:pick-project-folder', async (event) => {
    authorize(event);
    const owner = window;
    if (owner === undefined) throw new Error('The app window is unavailable');
    const selected = await dialog.showOpenDialog(owner, {
      title: 'Open project',
      buttonLabel: 'Open project',
      defaultPath: settings.projectHome,
      properties: ['openDirectory'],
    });
    return selected.canceled ? null : (selected.filePaths[0] ?? null);
  });
  ipcMain.handle('porcelain:credentials-read', (event) => {
    authorize(event);
    return credentials.read();
  });
  ipcMain.handle('porcelain:credentials-write', (event, value: unknown) => {
    authorize(event);
    if (typeof value !== 'string')
      throw new Error('Credentials must be a string');
    return credentials.write(value);
  });
  ipcMain.handle('porcelain:credentials-clear', (event) => {
    authorize(event);
    return credentials.clear();
  });
  ipcMain.handle('porcelain:app-update-check', (event) => {
    authorize(event);
    return appUpdate.check();
  });
  ipcMain.handle('porcelain:app-update-install', (event) => {
    authorize(event);
    return appUpdate.install();
  });
  ipcMain.on('porcelain:app-update-watch', (event) => {
    if (trusted(event))
      event.sender.send('porcelain:app-update-state', appUpdate.read());
  });
  fixPath();
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: 'Porcelain',
        submenu: [
          { role: 'about' },
          { type: 'separator' },
          {
            id: 'open-settings',
            label: 'Settings…',
            accelerator: 'CommandOrControl+,',
            click: () => {
              void dispatch('open-settings');
            },
          },
          { type: 'separator' },
          { role: 'services' },
          { type: 'separator' },
          { role: 'hide' },
          { role: 'hideOthers' },
          { role: 'unhide' },
          { type: 'separator' },
          { role: 'quit' },
        ],
      },
      {
        label: 'File',
        submenu: [
          {
            id: 'open-project',
            label: 'Open Project…',
            accelerator: 'CommandOrControl+O',
            click: () => {
              void dispatch('open-project');
            },
          },
          { type: 'separator' },
          { role: 'close' },
        ],
      },
      { role: 'editMenu' },
      settings.development === undefined
        ? {
            label: 'View',
            submenu: [
              { role: 'resetZoom' },
              { role: 'zoomIn' },
              { role: 'zoomOut' },
              { type: 'separator' },
              { role: 'togglefullscreen' },
            ],
          }
        : { role: 'viewMenu' },
      { role: 'windowMenu' },
    ]),
  );
  server = await startLocalServer(settings);
  void server.exited.then(() => {
    if (!quitting)
      failure(new Error('The Porcelain server stopped unexpectedly'));
  });
  stopServing = serveDesktop(server, settings.development);
  session.defaultSession.webRequest.onBeforeSendHeaders(
    { urls: [liveAddress(server.address)] },
    (details, callback) => {
      const requestHeaders =
        server &&
        liveSocketHeaders(
          {
            url: details.url,
            contentsId: details.webContentsId,
            frame: details.frame,
            initiatorOrigin: details.initiatorOrigin,
            headers: details.requestHeaders,
          },
          window && {
            contentsId: window.webContents.id,
            mainFrame: window.webContents.mainFrame,
            url: window.webContents.getURL(),
          },
          server,
        );
      callback(
        requestHeaders === undefined ? { cancel: true } : { requestHeaders },
      );
    },
  );
  ipcMain.on('porcelain:appearance', (event, value: unknown) => {
    const appearance = desktopAppearanceSchema.safeParse(value);
    if (window === undefined || !trusted(event) || !appearance.success) return;
    nativeTheme.themeSource = appearance.data;
    window.setBackgroundColor(windowBackground());
  });
  ipcMain.on('porcelain:actions-ready', (event) => {
    if (window === undefined || !trusted(event)) return;
    actionsReady = true;
    if (pendingAction !== undefined) {
      window.webContents.send('porcelain:action', pendingAction);
      pendingAction = undefined;
    }
  });
  nativeTheme.on('updated', () =>
    window?.setBackgroundColor(windowBackground()),
  );
  await openWindow();
}

if (!app.requestSingleInstanceLock()) {
  closed = true;
  app.quit();
} else {
  void start().catch(failure);
}
