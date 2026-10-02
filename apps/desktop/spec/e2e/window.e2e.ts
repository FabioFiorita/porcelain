import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { listAccessResponseSchema } from '@porcelain/contracts/access';
import type { DesktopBridge } from '@porcelain/contracts/desktop';
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

function sidebarInset(page: Page) {
  return page.evaluate(() => {
    const header = document.querySelector('.desktop-sidebar-header');
    if (header == null) throw new Error('The sidebar header is missing');
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
      if (header == null || button == null)
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

test('closing the last window keeps the same server, the Dock reopens the window, and Quit stops the server, removes its socket and keeps its log', async ({
  desktop,
}) => {
  const app = await desktop.launch();
  const page = await app.window();
  await openSmokeProject(page, desktop.repository);
  const { pid } = await app.server();

  const windowClosed = page.waitForEvent('close');
  await app.electron.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()[0]?.close();
  });
  await windowClosed;
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
    (await readFile(join(desktop.profile, 'logs', 'server.log'), 'utf8'))
      .length,
  ).toBeGreaterThan(0);
  expect(app.errors).toEqual([]);
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
  expect(
    await app.electron.evaluate(({ nativeTheme }) => nativeTheme.themeSource),
  ).toBe('dark');
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
  await app.electron.evaluate(
    ({ BrowserWindow }) =>
      new Promise<void>((resolveMaximized) => {
        const view = BrowserWindow.getAllWindows()[0];
        if (view === undefined) throw new Error('The app window is missing');
        view.once('maximize', () => resolveMaximized());
        view.maximize();
      }),
  );
  expect(
    await app.electron.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0]?.isMaximized(),
    ),
  ).toBe(true);
  expect(app.errors).toEqual([]);
  await app.quit();

  const restarted = await desktop.launch();
  const restored = await restarted.window();
  await expect(
    restored.getByRole('button', { name: 'desktop-smoke', exact: true }),
  ).toBeVisible();
  expect(
    await restarted.electron.evaluate(({ BrowserWindow }) => {
      const view = BrowserWindow.getAllWindows()[0];
      return {
        bounds: view?.getNormalBounds(),
        maximized: view?.isMaximized(),
      };
    }),
  ).toEqual({ bounds, maximized: true });
  await expect(restored.locator('.dark').first()).toBeAttached();
  expect(
    await restarted.electron.evaluate(
      ({ nativeTheme }) => nativeTheme.themeSource,
    ),
  ).toBe('dark');
  expect(
    listAccessResponseSchema.parse(await restarted.askOwner('GET', '/access'))
      .devices,
  ).toEqual([]);
  const { pid } = await restarted.server();
  await restarted.quit();
  expect(processAlive(pid)).toBe(false);
  expect(restarted.errors).toEqual([]);
});
