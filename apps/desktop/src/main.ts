import { app, BrowserWindow, dialog, Menu, shell } from 'electron';
import fixPath from 'fix-path';
import { desktopSettings } from './settings.ts';
import { startLocalServer } from './server-host.ts';
import { localNavigation, externalNavigation } from './rules/navigation.ts';

app.setName('Porcelain');
const settings = desktopSettings(app.getPath('userData'), app.getAppPath());
app.setPath('userData', settings.profile);
let server: Awaited<ReturnType<typeof startLocalServer>> | undefined;
let window: BrowserWindow | undefined;
let quitting = false;
let closed = false;
let pairing = false;

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
  const origin = new URL(local.address).origin;
  const view = new BrowserWindow({
    width: settings.limits.desktop.windowWidth,
    height: settings.limits.desktop.windowHeight,
    minWidth: settings.limits.desktop.minWidth,
    minHeight: settings.limits.desktop.minHeight,
    title: 'Porcelain',
    show: false,
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
    },
  });
  window = view;
  view.once('closed', () => {
    window = undefined;
  });
  view.once('ready-to-show', () => view.show());
  view.webContents.session.setPermissionRequestHandler(
    (_contents, _permission, callback) => callback(false),
  );
  view.webContents.session.setPermissionCheckHandler(() => false);
  view.webContents.on('will-attach-webview', (event) => event.preventDefault());
  view.webContents.on('will-navigate', (event, url) => {
    if (!localNavigation(url, origin)) event.preventDefault();
  });
  view.webContents.on('will-redirect', (event, url) => {
    if (!localNavigation(url, origin)) event.preventDefault();
  });
  view.webContents.setWindowOpenHandler(({ url }) => {
    if (externalNavigation(url)) void shell.openExternal(url).catch(failure);
    return { action: 'deny' };
  });
  const pair = (url: string) => {
    if (
      !localNavigation(url, origin) ||
      new URL(url).pathname !== '/pair' ||
      new URL(url).hash !== '' ||
      pairing
    )
      return;
    pairing = true;
    void local
      .pairingLink()
      .then((link) => {
        if (!localNavigation(link, origin))
          throw new Error('The pairing link left the local server');
        if (!view.isDestroyed()) return view.loadURL(link);
      })
      .catch(failure)
      .finally(() => {
        pairing = false;
      });
  };
  view.webContents.on('did-navigate', (_event, url) => pair(url));
  view.webContents.on('did-navigate-in-page', (_event, url) => pair(url));
  await view.loadURL(local.address);
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
  process.stderr.write('Porcelain: stopping server\n');
  for (const view of BrowserWindow.getAllWindows()) view.destroy();
  void (server?.close() ?? Promise.resolve())
    .catch((error: unknown) => {
      process.stderr.write(
        `${error instanceof Error ? error.message : 'Server shutdown failed'}\n`,
      );
    })
    .finally(() => {
      closed = true;
      process.stderr.write('Porcelain: server stopped, exiting app\n');
      app.exit();
    });
});

async function start() {
  await app.whenReady();
  fixPath();
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      { role: 'appMenu' },
      { role: 'editMenu' },
      { role: 'viewMenu' },
      { role: 'windowMenu' },
    ]),
  );
  server = await startLocalServer(settings);
  void server.exited.then(() => {
    if (!quitting)
      failure(new Error('The Porcelain server stopped unexpectedly'));
  });
  await openWindow();
}

if (!app.requestSingleInstanceLock()) {
  closed = true;
  app.quit();
} else {
  void start().catch(failure);
}
