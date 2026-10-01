import { existsSync } from 'node:fs';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { isDeepStrictEqual } from 'node:util';
import { join } from 'node:path';
import { _electron, type Page } from 'playwright';
import { z } from 'zod';
import { askOwner } from '../apps/server/src/cli/owner-client.ts';

type DesktopProof = {
  executable: string;
  profile: string;
  repository: string;
  evidence: string;
};
const ownerStatus = z.object({ pid: z.number(), address: z.string() });
const inventory = z.object({
  projects: z.array(
    z.object({ worktrees: z.array(z.object({ path: z.string() })) }),
  ),
});
const access = z.object({ devices: z.array(z.object({ id: z.string() })) });

function requireProof(condition: boolean, promise: string) {
  if (!condition) throw new Error(promise);
}

export const desktopFeatures = [
  {
    name: 'bridge-capabilities',
    promise:
      'the installed preload persists one opaque credential string through encrypted storage and restart, refuses untrusted callers and unavailable encryption, clears saved credentials, exposes its app version, and reports local update checks and unavailable installation through removable state subscriptions',
    run: bridgeCapabilities,
  },
  {
    name: 'installed-project',
    promise:
      'the installed app starts its own server, opens a discovered real Git project, shows its desktop app version and update status, survives window close, reopens from the Dock, retains its project, preferences and window after restart without browser pairing, and stops its server on Quit',
    run: installedProject,
  },
];

async function bridgeCapabilities(input: DesktopProof) {
  const environment: Record<string, string> = {};
  for (const [name, value] of Object.entries(process.env))
    if (value !== undefined && name !== 'ELECTRON_RUN_AS_NODE')
      environment[name] = value;
  const launch = () =>
    _electron.launch({
      executablePath: input.executable,
      args: [
        '--data-directory',
        input.profile,
        '--project-home',
        input.repository,
      ],
      env: environment,
      timeout: 30_000,
    });
  const value = JSON.stringify([
    { name: 'Desktop proof', credential: 'test-only-bearer' },
  ]);
  const destination = join(input.profile, 'credentials.enc');
  const app = await launch();
  const child = app.process();
  try {
    const page = await app.firstWindow({ timeout: 30_000 });
    await page.waitForURL(
      (url) => url.protocol === 'porcelain:' && url.pathname !== '/pair',
    );
    requireProof(
      (await page.evaluate('window.porcelainDesktop.credentials.read()')) ===
        null,
      'A fresh app profile must have no saved credentials',
    );
    await page.evaluate(
      `window.porcelainDesktop.credentials.write(${JSON.stringify(value)})`,
    );
    requireProof(
      (await page.evaluate('window.porcelainDesktop.credentials.read()')) ===
        value,
      'The preload must restore the exact opaque string',
    );
    requireProof(
      !(await readFile(destination)).includes(Buffer.from('test-only-bearer')),
      'The app data file must not contain plaintext credentials',
    );
    requireProof(
      ((await stat(destination)).mode & 0o777) === 0o600,
      'Only the profile owner may read or write the encrypted file',
    );
    const current = await app.evaluate(({ app }) => app.getVersion());
    const updates = z
      .object({
        current: z.string(),
        available: z.string().nullable(),
        states: z.array(z.string()),
        unsubscribed: z.boolean(),
        installError: z.string(),
      })
      .parse(
        await page.evaluate(`(async () => {
      const bridge = window.porcelainDesktop.appUpdate;
      const states = [];
      let checking = false;
      let finished = () => {};
      const settled = new Promise((resolve) => { finished = resolve; });
      const unsubscribe = bridge.onState((state) => {
        states.push(state.status);
        if (state.status === 'checking') checking = true;
        if (checking && state.status === 'idle') finished();
      });
      const result = await bridge.check();
      await settled;
      unsubscribe();
      const count = states.length;
      let installError = '';
      try { await bridge.install(); } catch (error) { installError = error.message; }
      await bridge.check();
      return { current: bridge.current(), available: result.available, states, unsubscribed: states.length === count, installError };
    })()`),
      );
    requireProof(
      updates.current === current,
      'The preload must expose the installed app version synchronously',
    );
    requireProof(
      updates.available === null,
      'A local app must not invent an available release',
    );
    requireProof(
      updates.states.includes('checking') && updates.states.at(-1) === 'idle',
      'Update subscriptions must observe a completed check',
    );
    requireProof(
      updates.unsubscribed,
      'Unsubscribe must stop delivering update states',
    );
    requireProof(
      updates.installError.includes('unavailable for this local build'),
      'Installing without a release feed must reject',
    );
    const denied = await app.evaluate(async ({ BrowserWindow, app }) => {
      const main = BrowserWindow.getAllWindows()[0];
      if (main === undefined) throw new Error('The main window is missing');
      const rogue = new BrowserWindow({
        show: false,
        webPreferences: {
          preload: `${app.getAppPath()}/desktop/preload.cjs`,
          sandbox: true,
          contextIsolation: true,
          nodeIntegration: false,
        },
      });
      try {
        await rogue.loadURL(
          'data:text/html,<title>Untrusted bridge caller</title>',
        );
        const failures: unknown = await rogue.webContents
          .executeJavaScript(`(async () => {
          const bridge = window.porcelainDesktop;
          const operations = [() => bridge.credentials.read(), () => bridge.credentials.write('untrusted'), () => bridge.credentials.clear(), () => bridge.appUpdate.check(), () => bridge.appUpdate.install()];
          const failures = [];
          for (const operation of operations) {
            try { await operation(); failures.push(false); }
            catch (error) { failures.push(error.message.includes('Untrusted desktop request')); }
          }
          return failures;
        })()`);
        return failures;
      } finally {
        rogue.destroy();
      }
    });
    requireProof(
      isDeepStrictEqual(denied, [true, true, true, true, true]),
      'Every credential and app-update IPC operation must reject an untrusted window',
    );
    await closeDesktop(app);
  } finally {
    if (child.exitCode === null && child.signalCode === null)
      await closeDesktop(app).catch(() => child.kill('SIGKILL'));
  }
  const restarted = await launch();
  const restartedChild = restarted.process();
  try {
    const page = await restarted.firstWindow({ timeout: 30_000 });
    await page.waitForURL(
      (url) => url.protocol === 'porcelain:' && url.pathname !== '/pair',
    );
    requireProof(
      (await page.evaluate('window.porcelainDesktop.credentials.read()')) ===
        value,
      'Encrypted credentials must survive an app restart',
    );
    const encrypted = await readFile(destination);
    await restarted.evaluate(({ safeStorage }) => {
      safeStorage.isAsyncEncryptionAvailable = () => Promise.resolve(false);
    });
    const unavailable = await page.evaluate(`(async () => {
      try { await window.porcelainDesktop.credentials.write('must-not-be-stored'); return false; }
      catch (error) { return error.message.includes('unavailable'); }
    })()`);
    requireProof(
      unavailable === true,
      'The preload must reject writes when safeStorage is unavailable',
    );
    requireProof(
      isDeepStrictEqual(await readFile(destination), encrypted),
      'Unavailable encryption must preserve the previous ciphertext',
    );
    await page.evaluate('window.porcelainDesktop.credentials.clear()');
    requireProof(
      (await page.evaluate('window.porcelainDesktop.credentials.read()')) ===
        null && !existsSync(destination),
      'Clear must remove saved credentials even when encryption is unavailable',
    );
    await closeDesktop(restarted);
  } finally {
    if (restartedChild.exitCode === null && restartedChild.signalCode === null)
      await closeDesktop(restarted).catch(() => restartedChild.kill('SIGKILL'));
  }
  return {
    encryptedCredentials: true,
    restartRestoresCredentials: true,
    untrustedCallersRejected: true,
    unavailableEncryptionRejected: true,
    clearRemovesCredentials: true,
    currentAppVersion: true,
    localUpdateState: true,
    updateSubscriptionRemoved: true,
  };
}

async function installedProject(input: DesktopProof) {
  const errors: string[] = [];
  const environment: Record<string, string> = {};
  for (const [name, value] of Object.entries(process.env))
    if (value !== undefined && name !== 'ELECTRON_RUN_AS_NODE')
      environment[name] = value;
  const launch = () =>
    _electron.launch({
      executablePath: input.executable,
      args: [
        '--data-directory',
        input.profile,
        '--project-home',
        input.repository,
      ],
      env: environment,
      timeout: 30_000,
    });
  const app = await launch();
  const appProcess = app.process();
  app
    .process()
    .stderr?.on('data', (chunk: Buffer) => process.stderr.write(chunk));
  const data = join(input.profile, 'server');
  let serverPid: number | undefined;
  let visiblePage: Page | undefined;
  try {
    const page = await app.firstWindow({ timeout: 30_000 });
    visiblePage = page;
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    await page.waitForURL(
      (url) =>
        url.protocol === 'porcelain:' &&
        url.hostname === 'app' &&
        url.pathname !== '/pair',
      {
        timeout: 30_000,
      },
    );
    const status = ownerStatus.parse(
      await askOwner(data, 'GET', '/status', undefined, 5000),
    );
    serverPid = status.pid;
    requireProof(
      new URL(status.address).hostname === '127.0.0.1',
      'The app server must listen only on loopback',
    );
    requireProof(
      (await fetch(`${status.address}/api/inventory`)).status === 401,
      'The loopback server must refuse requests without authentication',
    );
    requireProof(
      (
        await fetch(`${status.address}/api/inventory`, {
          headers: { Authorization: 'Bearer wrong-desktop-secret' },
        })
      ).status === 401,
      'The loopback server must refuse an incorrect desktop credential',
    );
    const rendererAccess = z
      .object({
        cookies: z.string(),
        bridge: z.boolean(),
        node: z.boolean(),
        credential: z.boolean(),
      })
      .parse(
        await page.evaluate(
          `({ cookies: document.cookie, bridge: !!window.porcelainDesktop, node: 'require' in window, credential: 'credential' in (window.porcelainDesktop ?? {}) })`,
        ),
      );
    requireProof(
      rendererAccess.bridge &&
        rendererAccess.cookies === '' &&
        !rendererAccess.node &&
        !rendererAccess.credential,
      'The renderer must not receive the server credential or Node access',
    );
    await page
      .getByRole('button', { name: 'Open project', exact: true })
      .waitFor();
    await app.evaluate(({ Menu }) => {
      const item = Menu.getApplicationMenu()?.getMenuItemById('open-project');
      if (item == null)
        throw new Error('The native Open Project menu is missing');
      Reflect.apply(item.click, item, [item, undefined, undefined]);
    });
    const dialog = page.getByRole('dialog', { name: 'Open project' });
    await dialog.waitFor({ state: 'visible' });
    await dialog
      .getByRole('region', { name: 'Found on this machine', exact: true })
      .getByRole('button', {
        name: `desktop-smoke ${input.repository}`,
        exact: true,
      })
      .click();
    await dialog.waitFor({ state: 'hidden' });
    await page
      .getByRole('button', { name: 'desktop-smoke', exact: true })
      .waitFor();
    const opened: unknown = await page.evaluate(async () =>
      (
        await fetch('/api/inventory', {
          credentials: 'same-origin',
          headers: { 'x-porcelain-browser': '1' },
        })
      ).json(),
    );
    requireProof(
      inventory
        .parse(opened)
        .projects.some((project) =>
          project.worktrees.some(
            (worktree) => worktree.path === input.repository,
          ),
        ),
      'The real server must persist the opened project',
    );
    const chrome = z
      .object({ inset: z.string(), drag: z.string(), buttonDrag: z.string() })
      .parse(
        await page.evaluate(
          `(() => { const header = document.querySelector('.desktop-sidebar-header'); return { inset: getComputedStyle(header).paddingLeft, drag: getComputedStyle(header).getPropertyValue('app-region'), buttonDrag: getComputedStyle(header.querySelector('button')).getPropertyValue('app-region') }; })()`,
        ),
      );
    requireProof(
      chrome.inset === '82px' &&
        chrome.drag === 'drag' &&
        chrome.buttonDrag === 'no-drag',
      'The sidebar must leave room for Mac controls and keep its button clickable',
    );
    await page
      .getByRole('button', { name: 'desktop-smoke', exact: true })
      .click();
    await page.waitForURL((url) => url.pathname !== '/');
    await page.reload();
    await page
      .getByRole('button', { name: 'desktop-smoke', exact: true })
      .waitFor();
    const reviewToggle = page.getByRole('button', {
      name: 'Review',
      exact: true,
    });
    if (await reviewToggle.isVisible()) await reviewToggle.click();
    await page.getByRole('tab', { name: 'History', exact: true }).click();
    await page
      .getByRole('button', { name: 'Create smoke project', exact: false })
      .waitFor();
    await page.getByRole('tab', { name: 'Files', exact: true }).click();
    const readme = page.getByRole('treeitem', {
      name: 'README.md',
      exact: true,
    });
    await readme.click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Open', exact: true }).click();
    await page.getByText('Desktop smoke', { exact: true }).waitFor();
    await writeFile(
      join(input.repository, 'README.md'),
      '# Desktop smoke\n\nUpdated on disk through the desktop server.\n',
    );
    await page
      .getByText('Updated on disk through the desktop server.', { exact: true })
      .waitFor();
    const reviewSheet = page.getByRole('dialog', { name: 'Worktree review' });
    if (await reviewSheet.isVisible()) await page.keyboard.press('Escape');
    await app.evaluate(({ Menu }) => {
      const item = Menu.getApplicationMenu()?.getMenuItemById('open-settings');
      if (item == null) throw new Error('The native Settings menu is missing');
      Reflect.apply(item.click, item, [item, undefined, undefined]);
    });
    const settingsPage = page.getByRole('main', {
      name: 'Settings',
      exact: true,
    });
    await settingsPage.waitFor({ state: 'visible' });
    await settingsPage.getByRole('tab', { name: 'Dark', exact: true }).click();
    await page.waitForFunction("document.querySelector('.dark') !== null");
    requireProof(
      await app.evaluate(
        ({ nativeTheme }) => nativeTheme.themeSource === 'dark',
      ),
      'Appearance must update the native window',
    );
    await settingsPage
      .getByRole('button', { name: 'This computer', exact: true })
      .click();
    const appVersion = await app.evaluate(({ app }) => app.getVersion());
    await settingsPage
      .getByText(`Porcelain app ${appVersion}`, { exact: true })
      .waitFor();
    await settingsPage
      .getByText('This is the newest version of the app.', { exact: true })
      .waitFor();
    await settingsPage
      .getByRole('button', { name: 'Back', exact: true })
      .click();
    await settingsPage.waitFor({ state: 'hidden' });
    const bounds = await app.evaluate(({ BrowserWindow, screen }) => {
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
    await app.evaluate(
      ({ BrowserWindow }) =>
        new Promise<void>((resolveFullscreen) => {
          const view = BrowserWindow.getAllWindows()[0];
          if (view === undefined) throw new Error('The app window is missing');
          view.once('enter-full-screen', () => resolveFullscreen());
          view.setFullScreen(true);
        }),
    );
    await page.waitForFunction(
      "document.documentElement.classList.contains('desktop-fullscreen')",
    );
    requireProof(
      (await page.evaluate(
        "getComputedStyle(document.querySelector('.desktop-sidebar-header')).paddingLeft",
      )) === '12px',
      'Fullscreen must remove the traffic-light inset',
    );
    await app.evaluate(
      ({ BrowserWindow }) =>
        new Promise<void>((resolveFullscreen) => {
          const view = BrowserWindow.getAllWindows()[0];
          if (view === undefined) throw new Error('The app window is missing');
          view.once('leave-full-screen', () => resolveFullscreen());
          view.setFullScreen(false);
        }),
    );
    await page.waitForFunction(
      "!document.documentElement.classList.contains('desktop-fullscreen')",
    );
    await page.screenshot({
      path: join(input.evidence, 'installed-project.png'),
    });
    requireProof(
      existsSync(join(data, 'inventory.sqlite')),
      'The Electron server must create its SQLite database',
    );
    const windowClosed = page.waitForEvent('close');
    await app.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()[0]?.close();
    });
    await windowClosed;
    requireProof(
      app.windows().length === 0,
      'Closing the window must close the window',
    );
    requireProof(
      ownerStatus.parse(await askOwner(data, 'GET', '/status', undefined, 5000))
        .pid === serverPid,
      'Closing the last window must keep the same server running',
    );
    const reopened = app.waitForEvent('window');
    await app.evaluate(({ app: electronApp }) => {
      electronApp.emit('activate');
    });
    const view = await reopened;
    await view
      .getByRole('button', { name: 'desktop-smoke', exact: true })
      .waitFor();
    await app.evaluate(
      ({ BrowserWindow }) =>
        new Promise<void>((resolveMaximized) => {
          const view = BrowserWindow.getAllWindows()[0];
          if (view === undefined) throw new Error('The app window is missing');
          view.once('maximize', () => resolveMaximized());
          view.maximize();
        }),
    );
    requireProof(
      (await app.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()[0]?.isMaximized(),
      )) === true,
      'The Mac window must maximize before its saved-state proof',
    );
    process.stdout.write(
      'Desktop proof: project opened, window reopened; checking Quit\n',
    );
    await closeDesktop(app);
    requireProof(
      !existsSync(join(data, 'server.sock')),
      'Quit must remove the owner socket',
    );
    requireProof(!processAlive(serverPid), 'Quit must stop the managed server');
    const restarted = await launch();
    try {
      const restored = await restarted.firstWindow({ timeout: 30_000 });
      await restored
        .getByRole('button', { name: 'desktop-smoke', exact: true })
        .waitFor();
      const pairing = access.parse(
        await askOwner(data, 'GET', '/access', undefined, 5000),
      );
      requireProof(
        pairing.devices.length === 0,
        'The managed desktop session must not create browser pairings',
      );
      requireProof(
        isDeepStrictEqual(
          await restarted.evaluate(({ BrowserWindow }) =>
            BrowserWindow.getAllWindows()[0]?.getNormalBounds(),
          ),
          bounds,
        ),
        'Restarting must restore the saved window bounds',
      );
      requireProof(
        (await restarted.evaluate(({ BrowserWindow }) =>
          BrowserWindow.getAllWindows()[0]?.isMaximized(),
        )) === true,
        'Restarting must restore the maximized window',
      );
      await restored.waitForFunction(
        "document.querySelector('.dark') !== null",
      );
      requireProof(
        await restarted.evaluate(
          ({ nativeTheme }) => nativeTheme.themeSource === 'dark',
        ),
        'Restarting must keep appearance on the stable desktop origin',
      );
      const next = ownerStatus.parse(
        await askOwner(data, 'GET', '/status', undefined, 5000),
      );
      serverPid = next.pid;
    } finally {
      await closeDesktop(restarted);
    }
    requireProof(
      !processAlive(serverPid),
      'Quit after restart must stop the new server',
    );
    requireProof(errors.length === 0, `Renderer errors: ${errors.join('; ')}`);
    return {
      openedProject: true,
      nativeDatabase: true,
      realGitHistory: true,
      liveFileUpdates: true,
      closeKeepsServer: true,
      dockReopens: true,
      restartKeepsProjectAndPreferences: true,
      privateDesktopSession: true,
      stableOrigin: true,
      nativeMenus: true,
      nativeAppearance: true,
      desktopAppUpdates: true,
      windowRestored: true,
      maximizedRestored: true,
      fullscreenChrome: true,
      quitStopsServer: true,
    };
  } catch (error) {
    if (visiblePage !== undefined && !visiblePage.isClosed()) {
      await visiblePage
        .screenshot({ path: join(input.evidence, 'failure.png') })
        .catch(() => undefined);
      await writeFile(
        join(input.evidence, 'renderer.txt'),
        await visiblePage
          .locator('body')
          .innerText({ timeout: 5000 })
          .catch(() => 'The renderer did not answer'),
      );
    }
    await writeFile(
      join(input.evidence, 'failure.txt'),
      `${error instanceof Error ? (error.stack ?? error.message) : 'Desktop proof failed'}\n`,
    );
    throw error;
  } finally {
    if (appProcess.exitCode === null && appProcess.signalCode === null)
      await closeDesktop(app).catch(() => {
        appProcess.kill('SIGKILL');
      });
  }
}

function processAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function closeDesktop(app: Awaited<ReturnType<typeof _electron.launch>>) {
  const started = performance.now();
  const child = app.process();
  child.once('exit', (code, signal) =>
    process.stdout.write(
      `Desktop process exited (${code}, ${signal}) after ${Math.round(performance.now() - started)} ms\n`,
    ),
  );
  const timeout = AbortSignal.timeout(15_000);
  const expired = new Promise<never>((_resolve, reject) => {
    timeout.addEventListener(
      'abort',
      () =>
        reject(
          new Error(
            `The app did not quit after stopping its server (process ${child.pid}, exit ${child.exitCode}, signal ${child.signalCode})`,
          ),
        ),
      { once: true },
    );
  });
  await Promise.race([app.close(), expired]);
}
