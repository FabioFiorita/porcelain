import { Schema } from 'effect';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { cp, mkdtemp, realpath, rm } from 'node:fs/promises';
import { createServer as createHttpServer } from 'node:http';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { launchOptions, sampleRepository } from '@porcelain/desktop/kit/launch';
import { electronExecutable, stageDesktop } from '@porcelain/desktop/kit/stage';
import { _electron, type ElectronApplication } from 'playwright';
import {
  freePort,
  Refusal,
  refuseMissing,
  runCli,
  stopOutput,
  Usage,
} from '../../verify-core/cli.ts';
import { Registry } from '../../verify-core/registry.ts';
import { checkInstalledApp } from './installed.ts';
const readyWithinMs = 10 * 60 * 1000;
const quitWithinMs = 15_000;
const usage = `Usage: .agents/skills/desktop-verify/scripts/cli <command> [--instance <id>]
  start                   stage Porcelain Dev with a disposable profile and sample repository; print its identity and CDP endpoint
  status                  record native windows and process identities without activating the app
  doctor                  check the tools and list live instances
  stop                    stop the instance this CLI started; the evidence stays
  evidence                print the evidence folder and what it holds
  installed-check         check the installed app's lock only when explicitly requested; needs no instance
`;
const registry = new Registry({
  name: 'desktop',
  cli: new URL('./cli.ts', import.meta.url).href,
  detail: Schema.Struct({
    app: Schema.String,
    name: Schema.String,
    bundle: Schema.String,
    executable: Schema.String,
    pid: Schema.Finite,
    cdp: Schema.String,
    workspace: Schema.String,
    profile: Schema.String,
    repository: Schema.String,
    control: Schema.String,
    token: Schema.String,
  }),
  inputs: {
    roots: [
      'apps/desktop/src',
      'apps/desktop/spec/kit',
      'apps/web/src',
      'apps/web/public',
      'apps/web/index.html',
      'apps/web/vite.config.ts',
    ],
    apps: ['apps/desktop', 'apps/web'],
  },
  format: 'text',
  stale: (_instance, changed) =>
    changed
      ? 'The staged code changed; stop and start to rebuild it.'
      : undefined,
  stopWithinMs: 30_000,
});
function macProblem(): string | undefined {
  return process.platform === 'darwin'
    ? undefined
    : 'The desktop launcher needs macOS and launches disposable Porcelain Dev through Playwright Electron. Run it on a Mac (see .agents/skills/desktop-verify/SKILL.md).';
}
function electronProblem(): string | undefined {
  try {
    return existsSync(electronExecutable())
      ? undefined
      : 'Electron is not installed for apps/desktop. Install it with: pnpm install --frozen-lockfile';
  } catch {
    return 'Electron is not installed for apps/desktop. Install it with: pnpm install --frozen-lockfile';
  }
}
async function quit(
  electron: ElectronApplication,
  child: ReturnType<ElectronApplication['process']>,
  exited: Promise<void>,
) {
  let forced = false;
  const timeout = setTimeout(() => {
    if (child.exitCode !== null || child.signalCode !== null) return;
    forced = true;
    child.kill('SIGKILL');
  }, quitWithinMs);
  timeout.unref();
  try {
    const closing =
      child.exitCode === null && child.signalCode === null
        ? electron.close().then(
            () => undefined,
            (error: unknown) => error,
          )
        : Promise.resolve(undefined);
    await exited;
    const error = await closing;
    return {
      exitCode: child.exitCode,
      signal: child.signalCode,
      forced,
      complete: !forced && child.exitCode === 0 && error === undefined,
    };
  } finally {
    clearTimeout(timeout);
  }
}
function statusServer(
  electron: ElectronApplication,
  token: string,
): Promise<{ address: string; close: () => Promise<void> }> {
  const server = createHttpServer((request, response) => {
    if (request.headers['x-porcelain-control'] !== token) {
      response.writeHead(403).end('Refused: wrong control token\n');
      return;
    }
    if (request.method !== 'GET' || request.url !== '/status') {
      response.writeHead(404).end('Only GET /status is available\n');
      return;
    }
    electron
      .evaluate(({ app, BrowserWindow }) => ({
        app: { name: app.getName(), pid: process.pid },
        processes: app.getAppMetrics().map((entry) => ({
          pid: entry.pid,
          creationTime: entry.creationTime,
          type: entry.type,
          name: entry.name ?? null,
          serviceName: entry.serviceName ?? null,
        })),
        windows: BrowserWindow.getAllWindows().map((view) => {
          const current = view.webContents.getURL();
          const address = current === '' ? undefined : new URL(current);
          if (address !== undefined) {
            address.username = '';
            address.password = '';
            address.search = '';
            address.hash = '';
          }
          return {
            id: view.id,
            title: view.getTitle(),
            url: address?.href ?? '',
            bounds: view.getBounds(),
            fullscreen: view.isFullScreen(),
            focused: view.isFocused(),
            visible: view.isVisible(),
          };
        }),
      }))
      .then(
        (state) =>
          response
            .writeHead(200, { 'content-type': 'application/json' })
            .end(`${JSON.stringify(state, null, 2)}\n`),
        (error: unknown) =>
          response
            .writeHead(503)
            .end(`${error instanceof Error ? error.message : String(error)}\n`),
      );
  });
  return new Promise((done, fail) => {
    server.once('error', fail);
    server.listen(0, '127.0.0.1', () => {
      const bound = server.address();
      if (typeof bound !== 'object' || bound === null)
        fail(new Error('The status server has no port'));
      else
        done({
          address: `http://127.0.0.1:${bound.port}`,
          close: () =>
            new Promise<void>((closed, failed) =>
              server.close((error) => (error ? failed(error) : closed())),
            ),
        });
    });
  });
}
function identity(instance: Awaited<ReturnType<typeof registry.launch>>) {
  const detail = instance.detail;
  return `instance ${instance.id}\nevidence ${instance.evidence}\napp ${detail.app}\nname ${detail.name}\nbundle ${detail.bundle}\nexecutable ${detail.executable}\npid ${detail.pid}\nsupervisor ${instance.pid}\ncdp ${detail.cdp}\nprofile ${detail.profile}\nrepository ${detail.repository}\n`;
}
function serve(folder: string): Promise<void> {
  return registry.serve(folder, async (life) => {
    const workspace = await realpath(
      await mkdtemp(join('/tmp', 'porcelain-desktop-verify-')),
    );
    const app = join(workspace, 'app');
    const profile = join(workspace, 'profile');
    let appStopped = true;
    const rendererErrors: string[] = [];
    const requests = new Map<string, number>();
    life.onStop(async () => {
      const evidence = life.evidence();
      await evidence.note('renderer-errors.txt', rendererErrors.join('\n'));
      await evidence.note(
        'renderer-network.txt',
        [...requests]
          .map(([request, count]) => `${count} ${request}\n`)
          .join(''),
      );
      const log = join(profile, 'logs', 'server.log');
      if (existsSync(log)) await cp(log, join(evidence.folder, 'server.log'));
      if (!appStopped)
        throw new Refusal(
          `App shutdown incomplete; workspace kept: ${workspace}`,
        );
      await rm(workspace, { recursive: true, force: true });
    });
    const awake = spawn('caffeinate', ['-d', '-u', '-w', String(process.pid)], {
      detached: true,
      stdio: 'ignore',
    });
    if (awake.pid !== undefined) life.own(awake.pid);
    awake.unref();
    await stageDesktop({
      directory: app,
      productName: 'Porcelain Dev',
      web: true,
    });
    const repository = await sampleRepository(workspace);
    const cdp = `http://127.0.0.1:${await freePort()}`;
    const options = launchOptions({
      app,
      profile,
      projectHome: repository,
      switches: [`--remote-debugging-port=${new URL(cdp).port}`],
    });
    const electron = await _electron.launch(options);
    const child = electron.process();
    const exited = new Promise<void>((closed) =>
      child.once('close', () => closed()),
    );
    appStopped = false;
    let serverForced = false;
    let stderrTail = '';
    life.onStop(async () => {
      const outcome = await quit(electron, child, exited);
      appStopped = outcome.complete && !serverForced;
      await life
        .evidence()
        .note(
          'app-stop.txt',
          `${JSON.stringify({ ...outcome, serverForced, complete: appStopped }, null, 2)}\n`,
        );
      if (!appStopped) throw new Refusal('The app did not shut down normally.');
    });
    if (child.pid === undefined)
      throw new Refusal('The dev app has no captured PID');
    life.own(child.pid);
    electron.on('close', () => {
      if (life.stopping()) return;
      life
        .evidence()
        .note(
          'app-exited.txt',
          `Porcelain Dev exited; instance ${life.id} stopping.\n`,
        )
        .then(
          () => life.stop('the app exited'),
          () => life.stop('the app exited'),
        );
    });
    child.stderr?.on('data', (chunk: Buffer) => {
      const text = stderrTail + chunk.toString();
      serverForced ||= text.includes(
        'Porcelain: server shutdown deadline reached',
      );
      stderrTail = text.slice(-256);
      process.stderr.write(chunk);
    });
    const watched = new WeakSet<
      ReturnType<ElectronApplication['windows']>[number]
    >();
    const watch = (
      page: ReturnType<ElectronApplication['windows']>[number],
    ) => {
      if (watched.has(page)) return;
      watched.add(page);
      page.on('pageerror', (error) => rendererErrors.push(error.message));
      page.on('request', (request) => {
        const path = new URL(request.url()).pathname;
        if (!path.startsWith('/api/')) return;
        const key = `${request.method()} ${path}`;
        requests.set(key, (requests.get(key) ?? 0) + 1);
      });
    };
    electron.on('window', watch);
    const page = await electron.firstWindow();
    watch(page);
    await page.waitForURL(
      (url) =>
        url.protocol === 'porcelain:' &&
        url.hostname === 'app' &&
        url.pathname !== '/pair',
    );
    const name = await electron.evaluate(({ app }) => app.getName());
    const token = randomBytes(16).toString('hex');
    life.secret(token);
    const served = await statusServer(electron, token);
    life.onStop(served.close);
    const detail = {
      app,
      name,
      bundle: resolve(options.executablePath, '../../..'),
      executable: options.executablePath,
      pid: child.pid,
      cdp,
      workspace,
      profile,
      repository,
      control: served.address,
      token,
    };
    await life
      .evidence()
      .note(
        '000-start.txt',
        `instance ${life.id}\napp ${app}\nname ${name}\nbundle ${detail.bundle}\nexecutable ${detail.executable}\npid ${child.pid}\nsupervisor ${process.pid}\ncdp ${cdp}\nprofile ${profile}\nrepository ${repository}\nThe native folder sheet is untouched. Use native UI tools for menus, sheets and window interaction.\n`,
      );
    return detail;
  });
}
async function start(): Promise<string> {
  refuseMissing([macProblem() ?? electronProblem()]);
  const started = performance.now();
  const instance = await registry.launch({}, readyWithinMs);
  return `${identity(instance)}started in ${Math.round(performance.now() - started)} ms\n`;
}
function doctor(): string {
  const checks = [
    `node ${process.versions.node}`,
    macProblem() ??
      electronProblem() ??
      `macOS: ready\nElectron: ${electronExecutable()}`,
  ];
  const live = registry
    .list()
    .filter((entry) => entry.alive)
    .map(
      ({ instance }) =>
        `${instance.id} pid ${instance.detail.pid} ${instance.detail.repository}`,
    );
  return `${checks.join('\n')}\nlive instances: ${live.join(', ') || 'none'}\n`;
}
async function command(args: readonly string[]): Promise<string> {
  const { values, positionals } = parseArgs({
    args: [...args],
    options: { instance: { type: 'string' } },
    allowPositionals: true,
    strict: true,
  });
  const [name, ...rest] = positionals;
  if (name === 'serve' && rest.length === 1 && rest[0] !== undefined) {
    await serve(rest[0]);
    return '';
  }
  if (rest.length > 0) throw new Usage(usage);
  if (name === 'start') return start();
  if (name === 'doctor') return doctor();
  if (name === 'installed-check') {
    refuseMissing([macProblem()]);
    return checkInstalledApp(
      registry.evidenceFolder(`installed-${randomBytes(4).toString('hex')}`),
    );
  }
  if (name === 'stop')
    return stopOutput(await registry.stopById(values.instance));
  if (name === 'evidence')
    return registry
      .evidence({
        evidence: registry.evidencePath(values.instance),
        secrets: [],
      })
      .listing();
  if (name !== 'status') throw new Usage(usage);
  const instance = registry.chosen(values.instance);
  const response = await fetch(`${instance.detail.control}/status`, {
    headers: { 'x-porcelain-control': instance.detail.token },
    signal: AbortSignal.timeout(10_000),
  });
  const output = await response.text();
  if (!response.ok)
    throw new Refusal(registry.redactor(instance).text(output.trim()));
  const sourceChanged = (await registry.staleness(instance)) !== undefined;
  const state = `${identity(instance)}source changed ${sourceChanged}\n${registry.redactor(instance).text(output)}`;
  const file = await registry.evidence(instance).record('status', args, state);
  return `${state}\nrecorded ${file}\n`;
}
await runCli(command);
