import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
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
  private readonly exited: Promise<void>;
  readonly profile: string;
  readonly errors: string[] = [];
  readonly output: string[] = [];
  private readonly watched = new WeakSet<Page>();

  constructor(electron: ElectronApplication, profile: string) {
    this.electron = electron;
    this.child = electron.process();
    this.exited = new Promise<void>((resolveExit) =>
      this.child.once('close', () => resolveExit()),
    );
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
      if (item === null || item === undefined)
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

  async holdWrite(file: string, method: 'rename' | 'appendFile') {
    const marker = `Porcelain e2e: held ${method} ${file}`;
    await this.electron.evaluate(
      async (_, { file, method, marker }) => {
        const fs = process.getBuiltinModule('fs');
        const { syncBuiltinESMExports } = process.getBuiltinModule('module');
        const released = new Promise<void>((resolveRelease) => {
          Reflect.set(fs.promises, 'porcelainReleaseWrite', resolveRelease);
        });
        const write = fs.writeFile.bind(fs);
        fs.writeFile = Object.assign(
          (target: Parameters<typeof write>[0], ...args: unknown[]) => {
            const options = args[1];
            const flag: unknown =
              typeof options === 'object' && options !== null
                ? Reflect.get(options, 'flag')
                : undefined;
            const held =
              method === 'rename'
                ? typeof target === 'string' &&
                  target.startsWith(`${file}.`) &&
                  target.endsWith('.tmp')
                : target === file && flag === 'a';
            if (!held) {
              Reflect.apply(write, fs, [target, ...args]);
              return;
            }
            process.stderr.write(`${marker}\n`);
            void released.then(() => {
              Reflect.apply(write, fs, [target, ...args]);
            });
          },
          fs.writeFile,
        );
        syncBuiltinESMExports();
      },
      { file, method, marker },
    );
    return {
      marker,
      release: () =>
        this.electron.evaluate(() => {
          const fs = process.getBuiltinModule('fs');
          const release: unknown = Reflect.get(
            fs.promises,
            'porcelainReleaseWrite',
          );
          if (typeof release !== 'function')
            throw new Error('The write is not held');
          Reflect.apply(release, fs.promises, []);
        }),
    };
  }

  quit(): Promise<void> {
    const child = this.child;
    const checkExit = () => {
      if (
        this.output
          .join('')
          .includes('Porcelain: server shutdown deadline reached')
      )
        throw new Error(
          `The app forcibly stopped its server instead of completing shutdown\n${this.output.join('')}`,
        );
      if (child.exitCode !== 0)
        throw new Error(
          `The app exited abnormally (process ${child.pid}, exit ${child.exitCode}, signal ${child.signalCode})\n${this.output.join('')}`,
        );
    };
    if (child.exitCode !== null || child.signalCode !== null)
      return this.exited.then(checkExit);
    const timeout = AbortSignal.timeout(quitWithinMs);
    const expiration = Promise.withResolvers<never>();
    const expired = () => {
      const message = `The app did not quit after stopping its server (process ${child.pid}, exit ${child.exitCode}, signal ${child.signalCode})\n${this.output.join('')}`;
      child.kill('SIGKILL');
      expiration.reject(new Error(message));
    };
    timeout.addEventListener('abort', expired, { once: true });
    return Promise.race([
      Promise.all([
        this.electron
          .evaluate(({ app }) => app.quit())
          .catch((error: unknown) => {
            if (
              !(error instanceof Error) ||
              (!error.message.includes('closed') &&
                !error.message.includes('Execution context was destroyed'))
            )
              throw error;
          }),
        this.exited,
      ]).then(async () => {
        checkExit();
        await this.electron.close();
      }),
      expiration.promise,
    ]).finally(() => timeout.removeEventListener('abort', expired));
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
    launchSecondInstance: () => Promise<number | null>;
  };
};

type WorkerFixtures = { app: string };

async function keepScreenshots(
  launched: readonly DesktopApp[],
  testInfo: TestInfo,
): Promise<void> {
  for (const [index, desktop] of launched.entries()) {
    for (const [order, page] of desktop.electron.windows().entries())
      await page
        .screenshot({
          path: testInfo.outputPath(`app-${index}-window-${order}.png`),
        })
        .catch(() => undefined);
  }
}

async function keepLog(
  testInfo: TestInfo,
  name: string,
  body: string | Buffer,
): Promise<void> {
  const path = testInfo.outputPath(name);
  await writeFile(path, body);
  await testInfo.attach(name, { path, contentType: 'text/plain' });
}

async function keepFailure(
  launched: readonly DesktopApp[],
  testInfo: TestInfo,
): Promise<void> {
  for (const [index, desktop] of launched.entries()) {
    await keepLog(testInfo, `app-${index}-main.log`, desktop.output.join(''));
    const log = join(desktop.profile, 'logs', 'server.log');
    if (existsSync(log))
      await keepLog(testInfo, `app-${index}-server.log`, await readFile(log));
    if (desktop.errors.length > 0)
      await keepLog(
        testInfo,
        `app-${index}-renderer-errors.txt`,
        desktop.errors.join('\n'),
      );
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
    const launchSecondInstance = async () => {
      const options = launchOptions({
        app,
        profile: workspace.profile,
        projectHome: workspace.repository,
      });
      const secondary = spawn(options.executablePath, options.args, {
        env: options.env,
        stdio: 'ignore',
      });
      try {
        await once(secondary, 'exit', {
          signal: AbortSignal.timeout(options.timeout),
        });
        await keepLog(
          testInfo,
          'second-instance.txt',
          `App process ${secondary.pid} exited ${secondary.exitCode}\n`,
        );
        return secondary.exitCode;
      } finally {
        if (secondary.exitCode === null && secondary.signalCode === null)
          secondary.kill('SIGKILL');
      }
    };
    await use({ ...workspace, launch, launchSecondInstance });
    const failed = testInfo.status !== testInfo.expectedStatus;
    if (failed) await keepScreenshots(launched, testInfo);
    const closed = await Promise.allSettled(
      launched.map((desktop) => desktop.quit()),
    );
    if (failed || closed.some((result) => result.status === 'rejected'))
      await keepFailure(launched, testInfo);
    for (const result of closed)
      if (result.status === 'rejected') throw result.reason;
  },
});
