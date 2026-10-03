import { existsSync } from 'node:fs';
import { mkdtemp, readFile, realpath, rm } from 'node:fs/promises';
import { join } from 'node:path';
import {
  _electron,
  expect,
  test as base,
  type ElectronApplication,
  type Page,
  type TestInfo,
} from '@playwright/test';
import type { DesktopBridge } from '@porcelain/contracts/desktop';
import { askServerOwner, ownerStatus } from '@porcelain/server/kit/owner';
import { launchOptions, sampleRepository } from '../kit/launch.ts';
import { root } from '../kit/stage.ts';

export { expect };
export type { Page };

declare const porcelainDesktop: DesktopBridge;

export function stagedApp(): string {
  return join(root, 'dist/desktop/e2e');
}

export type PickerRequest = {
  ownerIsAppWindow: boolean;
  title: unknown;
  buttonLabel: unknown;
  defaultPath: unknown;
  properties: unknown;
};

type PickerSelection = { canceled: boolean; filePaths: string[] };

const quitWithinMs = 15_000;
const launchWithinMs = 30_000;
const pickerWithinMs = 10_000;

export function processAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export class DesktopApp {
  readonly electron: ElectronApplication;
  private readonly child: ReturnType<ElectronApplication['process']>;
  readonly profile: string;
  readonly errors: string[] = [];
  readonly output: string[] = [];
  private readonly watched = new WeakSet<Page>();

  constructor(electron: ElectronApplication, profile: string) {
    this.electron = electron;
    this.child = electron.process();
    this.profile = profile;
    this.child.stderr?.on('data', (chunk: Buffer) => {
      this.output.push(chunk.toString());
    });
  }

  get serverData(): string {
    return join(this.profile, 'server');
  }

  get credentialsFile(): string {
    return join(this.profile, 'credentials.enc');
  }

  watch(page: Page): Page {
    if (this.watched.has(page)) return page;
    this.watched.add(page);
    page.on('pageerror', (error) => this.errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') this.errors.push(message.text());
    });
    return page;
  }

  async window(): Promise<Page> {
    const page = this.watch(
      await this.electron.firstWindow({ timeout: launchWithinMs }),
    );
    await page.waitForURL(
      (url) =>
        url.protocol === 'porcelain:' &&
        url.hostname === 'app' &&
        url.pathname !== '/pair',
      { timeout: launchWithinMs },
    );
    return page;
  }

  async nextWindow(): Promise<Page> {
    return this.watch(await this.electron.waitForEvent('window'));
  }

  server() {
    return ownerStatus(this.serverData);
  }

  askOwner(method: 'GET' | 'POST', path: string, body?: unknown) {
    return askServerOwner(this.serverData, method, path, body);
  }

  async clickMenu(id: string): Promise<void> {
    await this.electron.evaluate(({ BrowserWindow, Menu }, id) => {
      const item = Menu.getApplicationMenu()?.getMenuItemById(id);
      if (item == null)
        throw new Error(`The native menu item ${id} is missing`);
      Reflect.apply(item.click, item, [
        undefined,
        BrowserWindow.getAllWindows()[0],
        undefined,
      ]);
    }, id);
  }

  menuRoles(): Promise<string[][]> {
    return this.electron.evaluate(({ Menu }) =>
      (Menu.getApplicationMenu()?.items ?? []).map((menu) =>
        (menu.submenu?.items ?? []).map((item) =>
          (item.role ?? '').toLowerCase(),
        ),
      ),
    );
  }

  async holdPicker(): Promise<void> {
    await this.electron.evaluate(({ BrowserWindow, dialog }) => {
      dialog.showOpenDialog = async (...args: unknown[]) => {
        const options = args[1];
        const read = (name: string): unknown =>
          typeof options === 'object' && options !== null
            ? Reflect.get(options, name)
            : undefined;
        Reflect.set(dialog, 'porcelainPickerRequest', {
          ownerIsAppWindow: args[0] === BrowserWindow.getAllWindows()[0],
          title: read('title'),
          buttonLabel: read('buttonLabel'),
          defaultPath: read('defaultPath'),
          properties: read('properties'),
        });
        return new Promise<{ canceled: boolean; filePaths: string[] }>(
          (resolve) => {
            Reflect.set(dialog, 'porcelainPickerAnswer', resolve);
          },
        );
      };
    });
  }

  async pickerRequest(): Promise<PickerRequest> {
    const deadline = performance.now() + pickerWithinMs;
    for (;;) {
      const request = await this.electron.evaluate(({ dialog }) => {
        const asked: unknown = Reflect.get(dialog, 'porcelainPickerRequest');
        if (asked === undefined) return undefined;
        Reflect.deleteProperty(dialog, 'porcelainPickerRequest');
        return asked;
      });
      if (isPickerRequest(request)) return request;
      if (performance.now() > deadline)
        throw new Error('The native project picker did not open');
      await new Promise((resolveWait) => setTimeout(resolveWait, 50));
    }
  }

  async answerPicker(selection: PickerSelection): Promise<void> {
    await this.electron.evaluate(({ dialog }, selection) => {
      const answer: unknown = Reflect.get(dialog, 'porcelainPickerAnswer');
      if (typeof answer !== 'function')
        throw new Error('The native project picker has not opened');
      Reflect.deleteProperty(dialog, 'porcelainPickerAnswer');
      Reflect.apply(answer, dialog, [selection]);
    }, selection);
  }

  quit(): Promise<void> {
    const child = this.child;
    if (child.exitCode !== null || child.signalCode !== null)
      return Promise.resolve();
    const timeout = AbortSignal.timeout(quitWithinMs);
    const expired = new Promise<never>((_resolve, reject) => {
      timeout.addEventListener(
        'abort',
        () => {
          const message = `The app did not quit after stopping its server (process ${child.pid}, exit ${child.exitCode}, signal ${child.signalCode})\n${this.output.join('')}`;
          child.kill('SIGKILL');
          reject(new Error(message));
        },
        { once: true },
      );
    });
    return Promise.race([this.electron.close(), expired]);
  }
}

function isPickerRequest(value: unknown): value is PickerRequest {
  return (
    typeof value === 'object' &&
    value !== null &&
    'ownerIsAppWindow' in value &&
    typeof value.ownerIsAppWindow === 'boolean'
  );
}

export function savedCredentials(page: Page) {
  return page.evaluate(() => porcelainDesktop.credentials.read());
}

export function writeCredentials(page: Page, value: string) {
  return page.evaluate(
    (saved) =>
      porcelainDesktop.credentials.write(saved).then(
        () => '',
        (error: unknown) => (error instanceof Error ? error.message : ''),
      ),
    value,
  );
}

export async function appRequest(
  page: Page,
  method: 'GET' | 'POST' | 'PUT',
  path: string,
  body?: unknown,
): Promise<unknown> {
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
      const answer: unknown = await response.json();
      return answer;
    },
    { path, method, body },
  );
}

export function responsePolicy(page: Page, path: string) {
  return page.evaluate(
    async (address) =>
      (await fetch(address)).headers.get('content-security-policy'),
    path,
  );
}

type Workspace = { repository: string; profile: string; folder: string };

type DesktopFixtures = {
  workspace: Workspace;
  desktop: {
    repository: string;
    profile: string;
    folder: string;
    launch: (profile?: string) => Promise<DesktopApp>;
  };
};

type WorkerFixtures = { app: string };

async function keepFailure(
  launched: readonly DesktopApp[],
  testInfo: TestInfo,
): Promise<void> {
  for (const [index, desktop] of launched.entries()) {
    await testInfo.attach(`app-${index}-main.log`, {
      body: desktop.output.join(''),
      contentType: 'text/plain',
    });
    for (const [order, page] of desktop.electron.windows().entries())
      await page
        .screenshot({
          path: testInfo.outputPath(`app-${index}-window-${order}.png`),
        })
        .catch(() => undefined);
    const log = join(desktop.profile, 'logs', 'server.log');
    if (existsSync(log))
      await testInfo.attach(`app-${index}-server.log`, {
        body: await readFile(log),
        contentType: 'text/plain',
      });
    if (desktop.errors.length > 0)
      await testInfo.attach(`app-${index}-renderer-errors.txt`, {
        body: desktop.errors.join('\n'),
        contentType: 'text/plain',
      });
  }
}

export const test = base.extend<DesktopFixtures, WorkerFixtures>({
  app: [stagedApp(), { scope: 'worker', option: true }],
  workspace: async ({ app: _app }, use) => {
    const folder = await realpath(
      await mkdtemp(join('/tmp', 'porcelain-desktop-')),
    );
    await use({
      folder,
      repository: await sampleRepository(folder),
      profile: join(folder, 'profile'),
    });
    await rm(folder, { recursive: true, force: true });
  },
  desktop: async ({ app, workspace }, use, testInfo) => {
    const launched: DesktopApp[] = [];
    const launch = async (profile = workspace.profile) => {
      const electron = await _electron.launch(
        launchOptions({ app, profile, projectHome: workspace.repository }),
      );
      const desktop = new DesktopApp(electron, profile);
      launched.push(desktop);
      await electron.evaluate(() => {
        process.on('uncaughtExceptionMonitor', (error) => {
          process.stderr.write(`${error.stack ?? error.message}\n`);
        });
      });
      return desktop;
    };
    await use({ ...workspace, launch });
    if (testInfo.status !== testInfo.expectedStatus)
      await keepFailure(launched, testInfo);
    const closed = await Promise.allSettled(
      launched.map((desktop) => desktop.quit()),
    );
    for (const result of closed)
      if (result.status === 'rejected') throw result.reason;
  },
});
