import { existsSync } from 'node:fs';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { isDeepStrictEqual } from 'node:util';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { _electron, type Page } from 'playwright';
import { z } from 'zod';
import type { DesktopBridge } from '@porcelain/contracts/desktop';
import { askOwner } from '../../../../apps/server/src/cli/owner-client.ts';

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
declare const parent: { readonly document: unknown };
declare function getComputedStyle(element: RendererElement): RendererStyle;

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
const summaryProject = z.object({
  id: z.string(),
  worktrees: z.array(z.object({ id: z.string(), main: z.boolean() })),
});
const summaryPublication = z.object({
  review: z
    .object({
      summary: z.object({
        url: z.string(),
      }),
    })
    .nullish(),
});
const remoteInventory = z.object({
  environmentId: z.string(),
  environment: z.object({ name: z.string() }),
});
const summaryPairing = z.object({
  grants: z.array(z.object({ link: z.string() })),
});

function requireProof(condition: boolean, promise: string) {
  if (!condition) throw new Error(promise);
}

export const desktopFeatures = [
  {
    name: 'review-summaries',
    promise:
      'the installed app renders local and remote signed HTML summaries through its own origin inside isolated sandboxes, preserves their theme and layer links, refuses to let a summary show a website in its frame, and keeps app scripts restricted to its own origin',
    run: reviewSummaries,
  },
  {
    name: 'bridge-capabilities',
    promise:
      'the installed preload persists one opaque credential string through encrypted storage and restart, reports credentials it cannot decrypt as unreadable and never saves over them, tells the owner in Settings, refuses untrusted callers and unavailable encryption, clears saved credentials, exposes its app version, and reports local update checks and unavailable installation through removable state subscriptions',
    run: bridgeCapabilities,
  },
  {
    name: 'installed-project',
    promise:
      'the installed app starts its own server, permits remote connections with scripts restricted to the app origin, opens only a manually selected Git project through its trusted native picker, cancels without registration or folder discovery, shows app updates, retains its project and preferences after restart, survives window close and stops its server on Quit',
    run: installedProject,
  },
];

async function launchDesktop(input: DesktopProof) {
  const environment: Record<string, string> = {};
  for (const [name, value] of Object.entries(process.env))
    if (value !== undefined && name !== 'ELECTRON_RUN_AS_NODE')
      environment[name] = value;
  return _electron.launch({
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
}

async function desktopRequest(
  page: Page,
  path: string,
  method: string,
  body?: unknown,
) {
  return page.evaluate(
    async ({ path, method, body }) => {
      const response = await fetch(path, {
        method,
        headers: {
          'x-porcelain-browser': '1',
          'content-type': 'application/json',
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      if (!response.ok)
        throw new Error(`${method} ${path}: ${response.status}`);
      return response.json();
    },
    { path, method, body },
  );
}

async function publishDesktopSummary(
  page: Page,
  repository: string,
  title: string,
) {
  const project = summaryProject.parse(
    await desktopRequest(page, '/api/projects', 'POST', { path: repository }),
  );
  const worktree = project.worktrees.find((entry) => entry.main);
  if (worktree === undefined)
    throw new Error('The summary project has no main worktree');
  const publication = summaryPublication.parse(
    await desktopRequest(page, `/api/worktrees/${worktree.id}/review`, 'PUT', {
      expectedRevision: 0,
      summaryHtml: `<html><body><h1>${title}</h1><a href="#layer-1">Open ${title} layer</a> <a href="https://example.com/">Leave for a website</a></body></html>`,
      layers: [
        {
          id: randomUUID(),
          title: `${title} layer`,
          summary: 'A disposable review',
          lanes: ['Docs'],
          steps: [
            {
              id: randomUUID(),
              lane: 0,
              title: 'Readme',
              text: 'Review the readme',
              kind: 'context',
              pointer: { path: 'README.md', startLine: 1, endLine: 1 },
            },
          ],
        },
      ],
    }),
  );
  if (publication.review == null)
    throw new Error('The published summary is missing');
  return { project, worktree, review: publication.review };
}

async function reviewSummaries(input: DesktopProof) {
  const local = await launchDesktop(input);
  let remote: Awaited<ReturnType<typeof launchDesktop>> | undefined;
  let page: Page | undefined;
  const errors: string[] = [];
  try {
    page = await local.firstWindow();
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    await page
      .getByRole('button', { name: 'Open project', exact: true })
      .waitFor();
    const here = await publishDesktopSummary(
      page,
      input.repository,
      'Local summary',
    );
    await page.goto(
      `porcelain://app/${here.project.id}/${here.worktree.id}?entry=handoff`,
    );
    const localSummary = page.frameLocator('iframe[title="Review summary"]');
    await localSummary
      .getByRole('heading', { name: 'Local summary', exact: true })
      .waitFor();
    const localFrame = page
      .frames()
      .find((frame) => frame.url().includes('/review-summaries/'));
    if (localFrame === undefined)
      throw new Error('The local summary frame is missing');
    const localPolicy = await page.evaluate(
      async (path) =>
        (await fetch(path)).headers.get('content-security-policy'),
      here.review.summary.url,
    );
    requireProof(
      localPolicy ===
        'sandbox allow-scripts allow-forms allow-popups allow-modals',
      'The desktop protocol must retain the summary server sandbox policy',
    );
    await localFrame
      .locator('html[data-theme="dark"], html[data-theme="light"]')
      .waitFor();
    await localSummary
      .getByRole('link', { name: 'Open Local summary layer', exact: true })
      .click();
    await page
      .getByRole('region', {
        name: 'Review layer Local summary layer',
        exact: true,
      })
      .waitFor();

    const remoteProfile = join(input.profile, 'remote');
    remote = await launchDesktop({ ...input, profile: remoteProfile });
    const otherPage = await remote.firstWindow();
    await otherPage
      .getByRole('button', { name: 'Open project', exact: true })
      .waitFor();
    const there = await publishDesktopSummary(
      otherPage,
      input.repository,
      'Remote summary',
    );
    const status = ownerStatus.parse(
      await askOwner(
        join(remoteProfile, 'server'),
        'GET',
        '/status',
        undefined,
        5000,
      ),
    );
    const issued = summaryPairing.parse(
      await askOwner(
        join(remoteProfile, 'server'),
        'POST',
        '/pairings',
        { labels: ['Desktop summary proof'], addresses: [status.address] },
        5000,
      ),
    );
    const grant = issued.grants[0];
    if (grant === undefined)
      throw new Error('The remote pairing grant is missing');
    const other = remoteInventory.parse(
      await desktopRequest(otherPage, '/api/inventory', 'GET'),
    );
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    const settings = page.getByRole('main', { name: 'Settings', exact: true });
    await settings
      .getByRole('button', { name: 'Remote computers', exact: true })
      .click();
    await settings
      .getByRole('textbox', { name: 'Pairing link', exact: true })
      .fill(grant.link);
    await settings.getByRole('button', { name: 'Add', exact: true }).click();
    await settings
      .getByRole('list', { name: 'Remote computers', exact: true })
      .getByRole('listitem', { name: other.environment.name, exact: true })
      .waitFor();
    await settings.getByRole('button', { name: 'Back', exact: true }).click();
    await settings.waitFor({ state: 'hidden' });
    const computer = page.getByRole('group', {
      name: other.environment.name,
      exact: true,
    });
    if (!(await computer.isVisible()))
      await page
        .getByRole('button', { name: 'Toggle Sidebar', exact: true })
        .click();
    await computer.getByRole('button', { name: /Main worktree/ }).click();
    await page.waitForURL(
      (url) =>
        url.pathname ===
        `/remotes/${other.environmentId}/${there.project.id}/${there.worktree.id}`,
    );
    await page
      .getByRole('button', { name: 'Review summary', exact: true })
      .click();
    const summary = page.frameLocator('iframe[title="Review summary"]');
    await summary
      .getByRole('heading', { name: 'Remote summary', exact: true })
      .waitFor();
    const frame = page
      .frames()
      .find(
        (entry) =>
          entry.url().startsWith('porcelain://app/remote-review-summaries/') &&
          new URL(entry.url()).searchParams.get('computer') ===
            new URL(status.address).origin,
      );
    if (frame === undefined)
      throw new Error(
        'The remote summary did not load through the app from its own computer',
      );
    await frame
      .locator('html[data-theme="dark"], html[data-theme="light"]')
      .waitFor();
    const isolation = await frame.evaluate(() => {
      const parentDenied = (() => {
        try {
          return parent.document === null;
        } catch {
          return true;
        }
      })();
      return {
        parentDenied,
        node: 'require' in globalThis,
        bridge: 'porcelainDesktop' in globalThis,
      };
    });
    requireProof(
      isolation.parentDenied && !isolation.node && !isolation.bridge,
      'A remote summary must not read the app, Node or the desktop bridge',
    );
    requireProof(
      (await page
        .locator('iframe[title="Review summary"]')
        .getAttribute('sandbox')) ===
        'allow-scripts allow-forms allow-popups allow-modals',
      'The review iframe must retain its sandbox without same-origin access',
    );
    await summary
      .getByRole('link', { name: 'Open Remote summary layer', exact: true })
      .click();
    await page
      .getByRole('region', {
        name: 'Review layer Remote summary layer',
        exact: true,
      })
      .waitFor();
    const policy = await page.evaluate(async () =>
      (await fetch('/')).headers.get('content-security-policy'),
    );
    requireProof(
      policy !== null &&
        policy.split('; ').includes("script-src 'self'") &&
        policy.split('; ').includes("frame-src 'self' blob:"),
      'The app must frame only itself and its blobs while restricting its scripts',
    );
    requireProof(errors.length === 0, `Renderer errors: ${errors.join('; ')}`);
    await page.screenshot({ path: join(input.evidence, 'remote-layer.png') });
    await page
      .getByRole('button', { name: 'Review summary', exact: true })
      .click();
    const refused = page.waitForEvent('console', {
      predicate: (message) =>
        message.text().includes("'https://example.com/'") &&
        message.text().includes('frame-src'),
      timeout: 10_000,
    });
    await summary
      .getByRole('link', { name: 'Leave for a website', exact: true })
      .click();
    await refused;
    requireProof(
      page.frames().every((entry) => !entry.url().startsWith('https:')),
      'A summary must not navigate its frame to a website inside the app window',
    );
    return {
      localSummaryRendered: true,
      localThemeAndLayerLink: true,
      remoteSummaryRendered: true,
      remoteThemeAndLayerLink: true,
      summaryIsolated: true,
      summaryCannotShowWebsites: true,
      appScriptPolicyRetained: true,
    };
  } catch (error) {
    if (page !== undefined && !page.isClosed())
      await page
        .screenshot({ path: join(input.evidence, 'failure.png') })
        .catch(() => undefined);
    throw error;
  } finally {
    if (remote !== undefined) await closeDesktop(remote);
    await closeDesktop(local);
  }
}

function savedCredentials(page: Page) {
  return page.evaluate(() => porcelainDesktop.credentials.read());
}

async function bridgeCapabilities(input: DesktopProof) {
  const launch = () => launchDesktop(input);
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
      isDeepStrictEqual(await savedCredentials(page), { status: 'empty' }),
      'A fresh app profile must have no saved credentials',
    );
    await page.evaluate(
      (saved) => porcelainDesktop.credentials.write(saved),
      value,
    );
    requireProof(
      isDeepStrictEqual(await savedCredentials(page), {
        status: 'saved',
        value,
      }),
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
    const updates = await page.evaluate(async () => {
      const bridge = porcelainDesktop.appUpdate;
      const states: string[] = [];
      let checking = false;
      const settled = Promise.withResolvers<void>();
      const unsubscribe = bridge.onState((state) => {
        states.push(state.status);
        if (state.status === 'checking') checking = true;
        if (checking && state.status === 'idle') settled.resolve();
      });
      const result = await bridge.check();
      await settled.promise;
      unsubscribe();
      const count = states.length;
      const installError = await bridge.install().then(
        () => '',
        (error: unknown) => (error instanceof Error ? error.message : ''),
      );
      await bridge.check();
      return {
        current: bridge.current(),
        available: result.available,
        states,
        unsubscribed: states.length === count,
        installError,
      };
    });
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
    const rogueOpened = app.waitForEvent('window');
    const rogueId = await app.evaluate(async ({ BrowserWindow, app }) => {
      const rogue = new BrowserWindow({
        show: false,
        webPreferences: {
          preload: `${app.getAppPath()}/desktop/preload.cjs`,
          sandbox: true,
          contextIsolation: true,
          nodeIntegration: false,
        },
      });
      await rogue.loadURL(
        'data:text/html,<title>Untrusted bridge caller</title>',
      );
      return rogue.id;
    });
    const rogue = await rogueOpened;
    const denied = await rogue.evaluate(async () => {
      const bridge = porcelainDesktop;
      const operations = [
        () => bridge.credentials.read(),
        () => bridge.credentials.write('untrusted'),
        () => bridge.credentials.clear(),
        () => bridge.appUpdate.check(),
        () => bridge.appUpdate.install(),
      ];
      const failures: boolean[] = [];
      for (const operation of operations)
        failures.push(
          await operation().then(
            () => false,
            (error: unknown) =>
              error instanceof Error &&
              error.message.includes('Untrusted desktop request'),
          ),
        );
      return failures;
    });
    await app.evaluate(({ BrowserWindow }, id) => {
      BrowserWindow.fromId(id)?.destroy();
    }, rogueId);
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
      isDeepStrictEqual(await savedCredentials(page), {
        status: 'saved',
        value,
      }),
      'Encrypted credentials must survive an app restart',
    );
    const encrypted = await readFile(destination);
    await restarted.evaluate(({ safeStorage }) => {
      safeStorage.decryptStringAsync = () =>
        Promise.reject(new Error('Keychain access denied'));
    });
    requireProof(
      isDeepStrictEqual(await savedCredentials(page), {
        status: 'unreadable',
        message:
          'The saved credentials could not be read: Keychain access denied',
      }),
      'Credentials the app cannot decrypt must read as unreadable, not as empty',
    );
    const overwrite = await page.evaluate(() =>
      porcelainDesktop.credentials.write('[]').then(
        () => '',
        (error: unknown) => (error instanceof Error ? error.message : ''),
      ),
    );
    requireProof(
      overwrite.includes('kept unchanged') &&
        isDeepStrictEqual(await readFile(destination), encrypted),
      'A write must never replace credentials the app could not read',
    );
    await page.reload();
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    const settings = page.getByRole('main', { name: 'Settings', exact: true });
    await settings
      .getByRole('button', { name: 'Remote computers', exact: true })
      .click();
    await settings
      .getByText('Saved remote computers could not be read', { exact: true })
      .waitFor();
    requireProof(
      isDeepStrictEqual(await readFile(destination), encrypted),
      'Opening the app over unreadable credentials must not save over them',
    );
    await restarted.evaluate(({ safeStorage }) => {
      safeStorage.isAsyncEncryptionAvailable = () => Promise.resolve(false);
    });
    const unavailable = await page.evaluate(() =>
      porcelainDesktop.credentials.write('must-not-be-stored').then(
        () => false,
        (error: unknown) =>
          error instanceof Error && error.message.includes('unavailable'),
      ),
    );
    requireProof(
      unavailable,
      'The preload must reject writes when safeStorage is unavailable',
    );
    requireProof(
      isDeepStrictEqual(await readFile(destination), encrypted),
      'Unavailable encryption must preserve the previous ciphertext',
    );
    await page.evaluate(() => porcelainDesktop.credentials.clear());
    requireProof(
      isDeepStrictEqual(await savedCredentials(page), { status: 'empty' }) &&
        !existsSync(destination),
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
    unreadableCredentialsKept: true,
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
  const launch = () => launchDesktop(input);
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
    const folderRequests: string[] = [];
    page.on('request', (request) => {
      if (/\/api\/projects\/(discover|folders)(\?|$)/u.test(request.url()))
        folderRequests.push(request.url());
    });
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
    const contentSecurityPolicy = await page.evaluate(async () =>
      (await fetch('/')).headers.get('content-security-policy'),
    );
    requireProof(
      contentSecurityPolicy !== null &&
        contentSecurityPolicy
          .split('; ')
          .includes("connect-src 'self' http: https: ws: wss:") &&
        contentSecurityPolicy.split('; ').includes("script-src 'self'"),
      'The installed desktop policy must allow remote HTTP and WebSocket connections while restricting scripts to the app origin',
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
    const rendererAccess = await page.evaluate(() => ({
      cookies: document.cookie,
      bridge: 'porcelainDesktop' in globalThis,
      node: 'require' in globalThis,
      credential: 'credential' in porcelainDesktop,
    }));
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
    const initial = await desktopRequest(page, '/api/inventory', 'GET');
    requireProof(
      inventory.parse(initial).projects.length === 0,
      'Startup must not register the repository under the project home',
    );
    await app.evaluate(({ dialog, BrowserWindow }, repository) => {
      dialog.showOpenDialog = async (...args: unknown[]) => {
        const owner = args[0];
        const options = args[1];
        if (
          owner !== BrowserWindow.getAllWindows()[0] ||
          typeof options !== 'object' ||
          options === null ||
          Reflect.get(options, 'title') !== 'Open project' ||
          Reflect.get(options, 'buttonLabel') !== 'Open project' ||
          Reflect.get(options, 'defaultPath') !== repository ||
          JSON.stringify(Reflect.get(options, 'properties')) !==
            JSON.stringify(['openDirectory'])
        )
          throw new Error('The picker must be a single-folder native sheet');
        return new Promise<{ canceled: boolean; filePaths: string[] }>(
          (resolve) => {
            Reflect.set(dialog, 'completeProjectSelection', resolve);
          },
        );
      };
    }, input.repository);
    await app.evaluate(({ Menu }) => {
      const item = Menu.getApplicationMenu()?.getMenuItemById('open-project');
      if (item == null)
        throw new Error('The native Open Project menu is missing');
      Reflect.apply(item.click, item, [item, undefined, undefined]);
    });
    const dialog = page.getByRole('dialog', { name: 'Open project' });
    await dialog.waitFor({ state: 'visible' });
    await completeProjectSelection(app, { canceled: true, filePaths: [] });
    await dialog.waitFor({ state: 'hidden' });
    const canceled = await desktopRequest(page, '/api/inventory', 'GET');
    requireProof(
      inventory.parse(canceled).projects.length === 0,
      'Canceling the native picker must not register a project',
    );
    await page
      .getByRole('button', { name: 'Open project', exact: true })
      .click();
    await dialog.waitFor({ state: 'visible' });
    await completeProjectSelection(app, {
      canceled: false,
      filePaths: [input.repository],
    });
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
    requireProof(
      folderRequests.length === 0,
      'The native project flow must not query server folder browsing or discovery',
    );
    const chrome = await page.evaluate(() => {
      const header = document.querySelector('.desktop-sidebar-header');
      const button = header?.querySelector('button');
      if (header == null || button == null)
        throw new Error('The sidebar header and its button are missing');
      return {
        inset: getComputedStyle(header).paddingLeft,
        drag: getComputedStyle(header).getPropertyValue('app-region'),
        buttonDrag: getComputedStyle(button).getPropertyValue('app-region'),
      };
    });
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
    await page.locator('.dark').first().waitFor({ state: 'attached' });
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
    await page
      .locator('html.desktop-fullscreen')
      .waitFor({ state: 'attached' });
    requireProof(
      (await page.evaluate(() => {
        const header = document.querySelector('.desktop-sidebar-header');
        if (header == null) throw new Error('The sidebar header is missing');
        return getComputedStyle(header).paddingLeft;
      })) === '12px',
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
    await page
      .locator('html.desktop-fullscreen')
      .waitFor({ state: 'detached' });
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
      await restored.locator('.dark').first().waitFor({ state: 'attached' });
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
      nativePickerSelection: true,
      canceledPickerDoesNotRegister: true,
      noAutomaticDiscovery: true,
      openedProject: true,
      nativeDatabase: true,
      realGitHistory: true,
      liveFileUpdates: true,
      closeKeepsServer: true,
      dockReopens: true,
      restartKeepsProjectAndPreferences: true,
      privateDesktopSession: true,
      remoteConnectionsAllowedByPolicy: true,
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

async function completeProjectSelection(
  app: Awaited<ReturnType<typeof _electron.launch>>,
  selection: { canceled: boolean; filePaths: string[] },
) {
  await app.evaluate(({ dialog }, selection) => {
    const complete: unknown = Reflect.get(dialog, 'completeProjectSelection');
    if (typeof complete !== 'function')
      throw new Error('The native project picker has not opened');
    Reflect.apply(complete, dialog, [selection]);
  }, selection);
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
