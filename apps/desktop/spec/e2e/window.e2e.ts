import { Schema } from 'effect';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { listAccessResponseSchema } from '@porcelain/contracts/access';
import {
  desktopWindowStateSchema,
  type DesktopBridge,
} from '@porcelain/contracts/desktop';
import {
  appRequest,
  expect,
  processAlive,
  responsePolicy,
  test,
  type DesktopApp,
  type Page,
} from './fixtures.ts';

type RendererElement = {
  querySelector(selector: string): RendererElement | null;
};
type RendererStyle = {
  readonly paddingLeft: string;
  getPropertyValue(name: string): string;
};
declare const porcelainDesktop: DesktopBridge;
declare const document: {
  readonly cookie: string;
  querySelector(selector: string): RendererElement | null;
};
declare function getComputedStyle(element: RendererElement): RendererStyle;
declare function addEventListener(
  type: 'beforeunload',
  listener: (event: { preventDefault(): void }) => void,
): void;

async function openSmokeProject(page: Page, repository: string) {
  await appRequest(page, 'POST', '/api/projects', { path: repository });
  await page.reload();
  const project = page.getByRole('button', {
    name: 'desktop-smoke',
    exact: true,
  });
  await expect(project).toBeVisible();
  return project;
}

async function quitDuringRequestSetup(app: DesktopApp, path: string) {
  const marker = 'Porcelain e2e: quit during request setup';
  await app.electron.evaluate(
    ({ app, net }, { marker, path }) => {
      const quit = (url: string) => {
        if (new URL(url).pathname + new URL(url).search !== path) return;
        process.stderr.write(`${marker}\n`);
        app.quit();
      };
      const nativeRequest = net.request.bind(net);
      net.request = (...args: Parameters<typeof net.request>) => {
        const options = args[0];
        quit(typeof options === 'string' ? options : (options.url ?? ''));
        return nativeRequest(...args);
      };
    },
    { marker, path },
  );
  return marker;
}

function sidebarInset(page: Page) {
  return page.evaluate(() => {
    const header = document.querySelector('.desktop-sidebar-header');
    if (header === null || header === undefined)
      throw new Error('The sidebar header is missing');
    return getComputedStyle(header).paddingLeft;
  });
}

async function fullscreen(app: DesktopApp, value: boolean) {
  await app.electron.evaluate(({ BrowserWindow }, value) => {
    const view = BrowserWindow.getAllWindows()[0];
    if (view === undefined) throw new Error('The app window is missing');
    view.focus();
    view.setFullScreen(value);
  }, value);
  await expect
    .poll(() =>
      app.electron.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()[0]?.isFullScreen(),
      ),
    )
    .toBe(value);
}

async function maximize(app: DesktopApp) {
  await app.electron.evaluate(({ BrowserWindow }) => {
    const view = BrowserWindow.getAllWindows()[0];
    if (view === undefined) throw new Error('The app window is missing');
    view.maximize();
  });
  await expect
    .poll(() =>
      app.electron.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()[0]?.isMaximized(),
      ),
    )
    .toBe(true);
}

async function closeWindow(app: DesktopApp, page: Page) {
  const rendererClosed = page.waitForEvent('close');
  const remaining = await app.electron.evaluate(async ({ BrowserWindow }) => {
    const view = BrowserWindow.getAllWindows()[0];
    if (view === undefined) throw new Error('The app window is missing');
    await new Promise<void>((resolve) => {
      view.once('closed', resolve);
      view.close();
    });
    return BrowserWindow.getAllWindows().length;
  });
  await rendererClosed;
  expect(remaining).toBe(0);
}

test('the app serves its window from a private loopback server that refuses other callers and keeps its credential from the renderer', async ({
  desktop,
}) => {
  const app = await desktop.launch();
  const page = await app.window();
  const policy = (await responsePolicy(page, '/'))?.split('; ') ?? [];
  expect(policy).toContain("connect-src 'self' http: https: ws: wss:");
  expect(policy).toContain("script-src 'self'");

  const server = await app.server();
  expect(new URL(server.address).hostname).toBe('127.0.0.1');
  expect((await fetch(`${server.address}/api/inventory`)).status).toBe(401);
  expect(
    (
      await fetch(`${server.address}/api/inventory`, {
        headers: { Authorization: 'Bearer wrong-desktop-secret' },
      })
    ).status,
  ).toBe(401);
  expect(
    await page.evaluate(() => ({
      cookies: document.cookie,
      bridge: 'porcelainDesktop' in globalThis,
      node: 'require' in globalThis,
      credential: 'credential' in porcelainDesktop,
    })),
  ).toEqual({ cookies: '', bridge: true, node: false, credential: false });
  expect(existsSync(join(app.serverData, 'inventory.sqlite'))).toBe(true);
  expect(app.errors).toEqual([]);
});

test('the sidebar leaves room for the traffic lights with its button clickable, and full screen drops the inset', async ({
  desktop,
}, testInfo) => {
  const app = await desktop.launch();
  const page = await app.window();
  await openSmokeProject(page, desktop.repository);
  expect(
    await page.evaluate(() => {
      const header = document.querySelector('.desktop-sidebar-header');
      const button = header?.querySelector('button');
      if (
        header === null ||
        header === undefined ||
        button === null ||
        button === undefined
      )
        throw new Error('The sidebar header and its button are missing');
      return {
        inset: getComputedStyle(header).paddingLeft,
        drag: getComputedStyle(header).getPropertyValue('app-region'),
        buttonDrag: getComputedStyle(button).getPropertyValue('app-region'),
      };
    }),
  ).toEqual({ inset: '82px', drag: 'drag', buttonDrag: 'no-drag' });

  await fullscreen(app, true);
  await expect(page.locator('html')).toHaveClass(/desktop-fullscreen/);
  expect(await sidebarInset(page)).toBe('12px');
  await fullscreen(app, false);
  await expect(page.locator('html')).not.toHaveClass(/desktop-fullscreen/);
  expect(await sidebarInset(page)).toBe('82px');
  await page.screenshot({ path: testInfo.outputPath('window.png') });
  expect(app.errors).toEqual([]);
});

test('Quit persists the latest maximized window before closing it, even while its atomic save is pending', async ({
  desktop,
}) => {
  const app = await desktop.launch();
  const page = await app.window();
  await expect(
    page.getByRole('button', { name: 'Open project', exact: true }),
  ).toBeVisible();
  const held = await app.holdWrite(join(app.profile, 'window.json'), 'rename');
  const unloadMarker = 'Porcelain e2e: page tried to prevent Quit';
  const dialogs: string[] = [];
  page.on('dialog', (dialog) => dialogs.push(dialog.type()));
  await page.evaluate(() =>
    addEventListener('beforeunload', (event) => event.preventDefault()),
  );
  const { pid } = await app.server();
  const bounds = await app.electron.evaluate(
    async ({ BrowserWindow }, unloadMarker) => {
      const view = BrowserWindow.getAllWindows()[0];
      if (view === undefined) throw new Error('The app window is missing');
      view.webContents.once('will-prevent-unload', () => {
        process.stderr.write(`${unloadMarker}\n`);
      });
      view.setBounds({ x: 40, y: 50, width: 980, height: 680 });
      return view.getNormalBounds();
    },
    unloadMarker,
  );
  await maximize(app);
  const quitting = app.quit();
  try {
    await expect.poll(() => app.output.join('')).toContain(held.marker);
    expect(
      await app.electron.evaluate(
        ({ BrowserWindow }) => BrowserWindow.getAllWindows().length,
      ),
    ).toBe(1);
    expect(
      await app.electron.evaluate(({ BrowserWindow, ipcMain, nativeTheme }) => {
        const view = BrowserWindow.getAllWindows()[0];
        if (view === undefined) throw new Error('The app window is missing');
        const sender = {
          sender: view.webContents,
          senderFrame: view.webContents.mainFrame,
        };
        const appearance = nativeTheme.themeSource;
        ipcMain.emit(
          'porcelain:appearance',
          sender,
          appearance === 'dark' ? 'light' : 'dark',
        );
        ipcMain.emit('porcelain:actions-ready', sender);
        nativeTheme.emit('updated');
        return nativeTheme.themeSource === appearance;
      }),
    ).toBe(true);
  } finally {
    await held.release();
    await quitting;
  }
  expect(dialogs).toEqual(['beforeunload']);
  expect(app.output.join('')).toContain(unloadMarker);
  expect(
    Schema.decodeUnknownSync(desktopWindowStateSchema)(
      JSON.parse(await readFile(join(app.profile, 'window.json'), 'utf8')),
    ),
  ).toEqual({ bounds, maximized: true });
  expect(existsSync(join(app.serverData, 'server.sock'))).toBe(false);
  expect(processAlive(pid)).toBe(false);
  expect(app.errors).toEqual([]);
});

test('delayed events after destroying a restored maximized window do not throw, and Quit stops the server', async ({
  desktop,
}) => {
  const first = await desktop.launch();
  await first.window();
  await maximize(first);
  await first.quit();
  const savedText = await readFile(
    join(desktop.profile, 'window.json'),
    'utf8',
  );
  const savedState = Schema.decodeUnknownSync(desktopWindowStateSchema)(
    JSON.parse(savedText),
  );
  expect(savedState.maximized).toBe(true);

  const app = await desktop.launch();
  await app.window();
  await expect
    .poll(() =>
      app.electron.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()[0]?.isMaximized(),
      ),
    )
    .toBe(true);
  const { pid } = await app.server();

  const delayed = await app.electron.evaluate(
    async ({ BrowserWindow, ipcMain, nativeTheme }) => {
      const view = BrowserWindow.getAllWindows()[0];
      if (view === undefined) throw new Error('The app window is missing');
      const contents = view.webContents;
      const sender = { sender: contents, senderFrame: contents.mainFrame };
      const appearance = nativeTheme.themeSource;
      const errors: string[] = [];
      view.prependOnceListener('closed', () => {
        for (const deliver of [
          () =>
            ipcMain.emit(
              'porcelain:appearance',
              sender,
              appearance === 'dark' ? 'light' : 'dark',
            ),
          () => ipcMain.emit('porcelain:actions-ready', sender),
          () => nativeTheme.emit('updated'),
        ]) {
          try {
            deliver();
          } catch (error) {
            errors.push(error instanceof Error ? error.message : String(error));
          }
        }
      });
      const closed = new Promise<void>((resolveClosed) =>
        view.once('closed', () => resolveClosed()),
      );
      view.close();
      await closed;

      for (const event of [
        'show',
        'hide',
        'minimize',
        'maximize',
        'unmaximize',
        'move',
        'resize',
        'restore',
        'enter-full-screen',
        'leave-full-screen',
        'ready-to-show',
      ]) {
        try {
          view.emit(event);
        } catch (error) {
          errors.push(error instanceof Error ? error.message : String(error));
        }
      }
      try {
        contents.emit('did-finish-load');
      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error));
      }
      return {
        destroyed: view.isDestroyed(),
        appearanceUnchanged: nativeTheme.themeSource === appearance,
        errors,
      };
    },
  );
  expect(delayed).toEqual({
    destroyed: true,
    appearanceUnchanged: true,
    errors: [],
  });
  await app.quit();
  expect(existsSync(join(app.serverData, 'server.sock'))).toBe(false);
  expect(processAlive(pid)).toBe(false);
});

test('closing the last window keeps the same server, the Dock reopens the window, and Quit stops the server, removes its socket and keeps its log', async ({
  desktop,
}) => {
  const app = await desktop.launch();
  const page = await app.window();
  await openSmokeProject(page, desktop.repository);
  const { pid } = await app.server();

  await closeWindow(app, page);
  expect(app.electron.windows()).toHaveLength(0);
  expect((await app.server()).pid).toBe(pid);

  const reopened = app.nextWindow();
  await app.electron.evaluate(({ app: electronApp }) => {
    electronApp.emit('activate');
  });
  await expect(
    (await reopened).getByRole('button', {
      name: 'desktop-smoke',
      exact: true,
    }),
  ).toBeVisible();

  await app.quit();
  expect(existsSync(join(app.serverData, 'server.sock'))).toBe(false);
  expect(processAlive(pid)).toBe(false);
  expect(
    await readFile(join(desktop.profile, 'logs', 'server.log'), 'utf8'),
  ).toContain('Porcelain server: closed\n');
  expect(app.errors).toEqual([]);
});

test('a second instance reopens the primary window and exits without starting another server', async ({
  desktop,
}) => {
  const app = await desktop.launch();
  const page = await app.window();
  const { pid } = await app.server();
  await closeWindow(app, page);
  const reopened = app.nextWindow();
  expect(await desktop.launchSecondInstance()).toBe(0);
  await expect(
    (await reopened).getByRole('button', { name: 'Open project', exact: true }),
  ).toBeVisible();
  expect(app.electron.windows()).toHaveLength(1);
  expect((await app.server()).pid).toBe(pid);
  await app.quit();
  expect(processAlive(pid)).toBe(false);
  expect(app.errors).toEqual([]);
});

test('Quit drains server output and persists its log before letting the server exit', async ({
  desktop,
}) => {
  const app = await desktop.launch();
  await app.window();
  const { pid } = await app.server();
  const log = join(app.profile, 'logs', 'server.log');
  const held = await app.holdWrite(log, 'appendFile');
  const quitting = app.quit();
  try {
    await expect.poll(() => app.output.join('')).toContain(held.marker);
    expect(existsSync(join(app.serverData, 'server.sock'))).toBe(false);
    expect(processAlive(pid)).toBe(true);
    expect(app.output.join('')).not.toContain('Porcelain server: exited');
  } finally {
    await held.release();
    await quitting;
  }
  expect(await readFile(log, 'utf8')).toContain('Porcelain server: closed\n');
  expect(app.output.join('')).toContain('Porcelain: server output persisted');
  expect(app.output.join('')).toContain('Porcelain server: exited 0');
  expect(processAlive(pid)).toBe(false);
  expect(app.errors).toEqual([]);
});

test('Quit during app request setup cancels forwarding without a main-process exception and stops the server', async ({
  desktop,
}) => {
  const app = await desktop.launch();
  const page = await app.window();
  await expect(
    page.getByRole('button', { name: 'Open project', exact: true }),
  ).toBeVisible();
  const { pid } = await app.server();
  const marker = 'Porcelain e2e: quit during request setup';
  const child = app.electron.process();
  await quitDuringRequestSetup(app, '/api/inventory?quit-during-setup=1');
  const request = page
    .evaluate(() => fetch('/api/inventory?quit-during-setup=1'))
    .catch((error: unknown) => {
      if (!(error instanceof Error) || !error.message.includes('closed'))
        throw error;
    });
  await expect.poll(() => app.output.join('')).toContain(marker);
  await app.quit();
  await request;
  expect(child.exitCode).toBe(0);
  expect(app.output.join('')).not.toContain('ReferenceError');
  expect(existsSync(join(app.serverData, 'server.sock'))).toBe(false);
  expect(processAlive(pid)).toBe(false);
});

test('Quit while reopening the window cancels its initial load without showing a failure dialog', async ({
  desktop,
}) => {
  const app = await desktop.launch();
  const page = await app.window();
  await expect(
    page.getByRole('button', { name: 'Open project', exact: true }),
  ).toBeVisible();
  const { pid } = await app.server();
  const child = app.electron.process();
  await closeWindow(app, page);
  const marker = await quitDuringRequestSetup(app, '/');
  const activation = app.electron
    .evaluate(({ app }) => app.emit('activate'))
    .catch((error: unknown) => {
      if (!(error instanceof Error) || !error.message.includes('closed'))
        throw error;
    });
  await expect.poll(() => app.output.join('')).toContain(marker);
  await app.quit();
  await activation;
  expect(child.exitCode).toBe(0);
  expect(app.output.join('')).not.toContain('ERR_ABORTED');
  expect(app.output.join('')).not.toContain('ERR_FAILED');
  expect(app.output.join('')).not.toContain('ReferenceError');
  expect(existsSync(join(app.serverData, 'server.sock'))).toBe(false);
  expect(processAlive(pid)).toBe(false);
});

test('restarting restores the saved window bounds, the maximized window, the dark appearance and the opened project, without pairing a browser', async ({
  desktop,
}) => {
  const app = await desktop.launch();
  const page = await app.window();
  await openSmokeProject(page, desktop.repository);
  await app.clickMenu('open-settings');
  const settings = page.getByRole('main', { name: 'Settings', exact: true });
  await settings.getByRole('tab', { name: 'Dark', exact: true }).click();
  await expect(page.locator('.dark').first()).toBeAttached();
  await expect
    .poll(() =>
      app.electron.evaluate(({ nativeTheme }) => nativeTheme.themeSource),
    )
    .toBe('dark');
  await settings.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(settings).toBeHidden();

  const bounds = await app.electron.evaluate(({ BrowserWindow, screen }) => {
    const view = BrowserWindow.getAllWindows()[0];
    if (view === undefined) throw new Error('The app window is missing');
    const area = screen.getPrimaryDisplay().workArea;
    view.setBounds({
      x: area.x + 30,
      y: area.y + 30,
      width: 980,
      height: 680,
    });
    return view.getBounds();
  });
  await maximize(app);
  expect(app.errors).toEqual([]);
  await app.quit();

  const restarted = await desktop.launch();
  const restored = await restarted.window();
  await expect(
    restored.getByRole('button', { name: 'desktop-smoke', exact: true }),
  ).toBeVisible();
  await expect
    .poll(() =>
      restarted.electron.evaluate(({ BrowserWindow }) => {
        const view = BrowserWindow.getAllWindows()[0];
        return {
          bounds: view?.getNormalBounds(),
          maximized: view?.isMaximized(),
        };
      }),
    )
    .toEqual({ bounds, maximized: true });
  await expect(restored.locator('.dark').first()).toBeAttached();
  await expect
    .poll(() =>
      restarted.electron.evaluate(({ nativeTheme }) => nativeTheme.themeSource),
    )
    .toBe('dark');
  expect(
    Schema.decodeUnknownSync(listAccessResponseSchema)(
      await restarted.askOwner('GET', '/access'),
    ).devices,
  ).toEqual([]);
  const { pid } = await restarted.server();
  await restarted.quit();
  expect(processAlive(pid)).toBe(false);
  expect(restarted.errors).toEqual([]);
});
