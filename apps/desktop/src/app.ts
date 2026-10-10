import { externalLink } from '@porcelain/client/links/rules';
import { NodeServices } from '@effect/platform-node';
import {
  Cause,
  Deferred,
  Effect,
  Exit,
  ManagedRuntime,
  Schema,
  Result,
  Scope,
} from 'effect';
import { LiveUpdatesApi } from '@porcelain/contracts/access';
import { HttpApiClient } from 'effect/http-api';
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
import { openWindowState } from './adapters/window-state.ts';
import {
  CredentialStorageError,
  openEncryptedCredentials,
} from './adapters/encrypted-credentials.ts';
import { openAppUpdate } from './adapters/app-update.ts';
import electronUpdater from 'electron-updater';
import { restoreWindowBounds } from './rules/window-bounds.ts';
import { registerDesktopScheme, serveDesktop } from './app-protocol.ts';
import fixPath from 'fix-path';
import { desktopSettings } from './settings.ts';
import { startLocalServer } from './server-host.ts';
import { DesktopError } from './errors/desktop-error.ts';
import { appDocument, desktopAddress } from './rules/navigation.ts';
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
  process.resourcesPath,
  app.isPackaged,
);
app.setPath('userData', settings.profile);
let server: Effect.Success<ReturnType<typeof startLocalServer>> | undefined;
let window: BrowserWindow | undefined;
let quitting = false;
let closed = false;
let actionsReady = false;
let pendingAction: DesktopAction | undefined;
let stopServing: (() => void) | undefined;
const runtime = ManagedRuntime.make(NodeServices.layer);
const quit = Deferred.makeUnsafe<void>();
let savedWindow: Effect.Success<ReturnType<typeof openWindowState>>;
let credentials: Effect.Success<ReturnType<typeof openEncryptedCredentials>>;

function releaseUpdater() {
  const updater = electronUpdater.autoUpdater;
  updater.autoDownload = false;
  return updater;
}

const appUpdate = openAppUpdate(
  settings.updateFeed ? releaseUpdater() : undefined,
  (state) => window?.webContents.send('porcelain:app-update-state', state),
);

function trusted(event: IpcMainEvent | IpcMainInvokeEvent): boolean {
  if (
    window === undefined ||
    window.isDestroyed() ||
    window.webContents.isDestroyed() ||
    event.sender.isDestroyed()
  )
    return false;
  return trustedSender(
    {
      contents: event.sender,
      frame: event.senderFrame,
      url: event.senderFrame?.url,
    },
    {
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

function updateWindowBackground(): void {
  if (!quitting && window !== undefined && !window.isDestroyed())
    window.setBackgroundColor(windowBackground());
}

function windowState(view: BrowserWindow) {
  return { bounds: view.getNormalBounds(), maximized: view.isMaximized() };
}

function openExternal(url: string): void {
  if (externalLink(url))
    runtime.runFork(
      Effect.tryPromise({
        try: () => shell.openExternal(url),
        catch: (cause) =>
          new DesktopError({
            message: cause instanceof Error ? cause.message : 'unknown failure',
            cause,
          }),
      }).pipe(
        Effect.catch((error) =>
          Effect.sync(() => {
            process.stderr.write(
              `Porcelain: could not open ${url}: ${error instanceof Error ? error.message : 'unknown failure'}\n`,
            );
          }),
        ),
      ),
    );
}

function failure(error: unknown) {
  if (quitting) return;
  process.stderr.write(
    `${error instanceof Error ? error.message : 'The local server failed'}\n`,
  );
  dialog.showErrorBox(
    'Porcelain could not continue',
    error instanceof Error ? error.message : 'The local server failed',
  );
  app.quit();
}

const openWindow = Effect.fn('openWindow')(function* () {
  const local = server;
  if (local === undefined || quitting) return;
  if (window !== undefined) {
    if (window.isMinimized()) window.restore();
    window.show();
    window.focus();
    return;
  }
  const restored = restoreWindowBounds(
    yield* savedWindow.read(),
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
        `--porcelain-live=${liveAddress(local.address, HttpApiClient.urlBuilder(LiveUpdatesApi).live.liveUpdates({ query: {} }))}`,
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
    if (!quitting && !view.isDestroyed() && !view.isFullScreen())
      runtime.runFork(savedWindow.schedule(windowState(view)));
  };
  view.on('close', () => {
    if (!quitting) {
      save();
      runtime.runFork(savedWindow.flush());
    }
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
  view.webContents.on('will-prevent-unload', (event) => {
    if (quitting) event.preventDefault();
  });
  yield* Effect.tryPromise(() => view.loadURL(desktopAddress));
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
app.on('activate', () => {
  runtime.runFork(
    openWindow().pipe(
      Effect.catch((error) => Effect.sync(() => failure(error))),
    ),
  );
});
app.on('second-instance', () => {
  runtime.runFork(
    openWindow().pipe(
      Effect.catch((error) => Effect.sync(() => failure(error))),
    ),
  );
});
app.on('before-quit', (event) => {
  if (closed) return;
  event.preventDefault();
  if (quitting) return;
  quitting = true;
  process.stderr.write('Porcelain: stopping server\n');
  const views = BrowserWindow.getAllWindows();
  for (const view of views) {
    if (!view.isFullScreen() && savedWindow !== undefined)
      runtime.runFork(savedWindow.schedule(windowState(view)));
  }
  Deferred.doneUnsafe(quit, Effect.void);
});

const dispatch = Effect.fn('dispatch')(
  function* (action: DesktopAction) {
    yield* openWindow();
    if (actionsReady) window?.webContents.send('porcelain:action', action);
    else pendingAction = action;
  },
  Effect.catch((error) => Effect.sync(() => failure(error))),
);

const start = Effect.fn('start')(function* () {
  yield* Effect.tryPromise(() => app.whenReady());
  ipcMain.handle('porcelain:pick-project-folder', (event) =>
    runtime.runPromise(
      Effect.gen(function* () {
        authorize(event);
        const owner = window;
        if (owner === undefined)
          return yield* Effect.die(new Error('The app window is unavailable'));
        const selected = yield* Effect.tryPromise(() =>
          dialog.showOpenDialog(owner, {
            title: 'Open project',
            buttonLabel: 'Open project',
            defaultPath: settings.projectHome,
            properties: ['openDirectory'],
          }),
        );
        return selected.canceled ? null : (selected.filePaths[0] ?? null);
      }),
    ),
  );
  ipcMain.handle('porcelain:credentials-read', (event) => {
    authorize(event);
    return runtime.runPromise(credentials.read());
  });
  ipcMain.handle('porcelain:credentials-write', (event, value: unknown) => {
    authorize(event);
    if (typeof value !== 'string')
      throw new Error('Credentials must be a string');
    return runtime.runPromise(credentials.write(value));
  });
  ipcMain.handle('porcelain:credentials-clear', (event) => {
    authorize(event);
    return runtime.runPromise(credentials.clear());
  });
  ipcMain.handle('porcelain:app-update-check', (event) => {
    authorize(event);
    return runtime.runPromise(appUpdate.check());
  });
  ipcMain.handle('porcelain:app-update-install', (event) => {
    authorize(event);
    return runtime.runPromise(appUpdate.install());
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
              runtime.runFork(dispatch('open-settings'));
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
              runtime.runFork(dispatch('open-project'));
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
  server = yield* startLocalServer(settings);
  yield* server.watch(() => {
    if (!quitting)
      failure(new Error('The Porcelain server stopped unexpectedly'));
  });
  stopServing = serveDesktop(server, settings.development);
  session.defaultSession.webRequest.onBeforeSendHeaders(
    {
      urls: [
        liveAddress(
          server.address,
          HttpApiClient.urlBuilder(LiveUpdatesApi).live.liveUpdates({
            query: {},
          }),
        ),
      ],
    },
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
          {
            ...server,
            livePath: HttpApiClient.urlBuilder(LiveUpdatesApi).live.liveUpdates(
              { query: {} },
            ),
          },
        );
      callback(
        requestHeaders === undefined ? { cancel: true } : { requestHeaders },
      );
    },
  );
  ipcMain.on('porcelain:appearance', (event, value: unknown) => {
    const appearance = Schema.decodeUnknownResult(desktopAppearanceSchema)(
      value,
    );
    if (quitting || !trusted(event) || !Result.isSuccess(appearance)) return;
    nativeTheme.themeSource = appearance.success;
    updateWindowBackground();
  });
  ipcMain.on('porcelain:actions-ready', (event) => {
    if (quitting || window === undefined || !trusted(event)) return;
    actionsReady = true;
    if (pendingAction !== undefined) {
      window.webContents.send('porcelain:action', pendingAction);
      pendingAction = undefined;
    }
  });
  nativeTheme.on('updated', updateWindowBackground);
  yield* openWindow();
});

if (!app.requestSingleInstanceLock()) {
  closed = true;
  app.quit();
} else {
  runtime.runFork(
    Effect.gen(function* () {
      savedWindow = yield* openWindowState(
        settings.profile,
        settings.limits.desktop.windowStateSaveMs,
      );
      credentials = yield* openEncryptedCredentials(settings.profile, {
        available: () =>
          Effect.tryPromise({
            try: () => safeStorage.isAsyncEncryptionAvailable(),
            catch: (cause) =>
              new CredentialStorageError({
                message:
                  cause instanceof Error
                    ? cause.message
                    : 'Encrypted credential storage failed',
                cause,
              }),
          }).pipe(
            Effect.map(
              (available) =>
                available &&
                (process.platform !== 'linux' ||
                  safeStorage.getSelectedStorageBackend() !== 'basic_text'),
            ),
          ),
        encrypt: (value) =>
          Effect.tryPromise({
            try: () => safeStorage.encryptStringAsync(value),
            catch: (cause) =>
              new CredentialStorageError({
                message:
                  cause instanceof Error
                    ? cause.message
                    : 'Encrypted credential storage failed',
                cause,
              }),
          }),
        decrypt: (value) =>
          Effect.tryPromise({
            try: () => safeStorage.decryptStringAsync(value),
            catch: (cause) =>
              new CredentialStorageError({
                message:
                  cause instanceof Error
                    ? cause.message
                    : 'Encrypted credential storage failed',
                cause,
              }),
          }).pipe(
            Effect.map((decrypted) => ({
              value: decrypted.result,
              reEncrypt: decrypted.shouldReEncrypt,
            })),
          ),
      });
      const serverScope = yield* Scope.make();
      yield* Effect.addFinalizer(() =>
        Effect.gen(function* () {
          yield* savedWindow.flush();
          yield* Effect.all(
            BrowserWindow.getAllWindows().map((view) =>
              Effect.callback<void>((resume) => {
                if (view.isDestroyed()) {
                  resume(Effect.void);
                  return;
                }
                view.once('closed', () => resume(Effect.void));
                view.close();
              }),
            ),
            { concurrency: 'unbounded' },
          );
          stopServing?.();
          yield* Scope.close(serverScope, Exit.void);
        }),
      );
      yield* start().pipe(
        Scope.provide(serverScope),
        Effect.raceFirst(Deferred.await(quit)),
      );
      yield* Deferred.await(quit);
    }).pipe(
      Effect.scoped,
      Effect.catchCause((cause) =>
        Effect.sync(() => {
          const error = Cause.squash(cause);
          if (quitting)
            process.stderr.write(
              `${error instanceof Error ? error.message : Cause.pretty(cause)}\n`,
            );
          else failure(error);
        }),
      ),
      Effect.ensuring(
        Effect.sync(() => {
          if (quitting) {
            closed = true;
            process.stderr.write('Porcelain: server stopped, exiting app\n');
            app.quit();
          }
        }),
      ),
    ),
  );
}
