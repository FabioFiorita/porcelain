import { Schema, Result } from 'effect';
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
  Usage,
} from '../../verify-core/cli.ts';
import {
  Registry,
  repositoryRoot as root,
} from '../../verify-core/registry.ts';
import {
  startBrowser,
  interact,
  interactionOptions,
  interactionUsage,
  playwrightCli,
  webInputs,
} from '../../web-verify/scripts/browser.ts';
import { checkInstalledApp } from './installed.ts';
import {
  nativeCommand,
  nativeRequestSchema,
  type NativeRequest,
} from './native.ts';
const stagedApp = join(root, 'dist/desktop/verify');
const readyWithinMs = 10 * 60 * 1000;
const quitWithinMs = 15_000;
const appOrigin = 'porcelain://app';
const usage = `Usage: .agents/skills/desktop-verify/scripts/cli <command> [--instance <id>]
  start                   stage Porcelain Dev and launch it with a disposable profile and sample repository
  doctor                  check the tools and list live instances
  stop                    stop the instance this CLI started; the evidence stays
  evidence                print the evidence folder and what it holds
${interactionUsage.replace('open a route of the web app', 'open a route of porcelain://app')}  menu [<path>]           record the application menu, or click the item at a path such as "File/Open Project…"
  window [resize <width> <height> | maximize | fullscreen on|off | close | activate]
                          record the window state, or change it first
  dialog [<folder> | --cancel]
                          answer the next native folder picker with a folder or a cancel; alone, record what the picker was asked
  installed-check         check the lock of the installed /Applications/Porcelain.app as a black box; needs no instance
`;
const registry = new Registry({
  name: 'desktop',
  cli: new URL('./cli.ts', import.meta.url).href,
  detail: Schema.Struct({
    session: Schema.String,
    workspace: Schema.String,
    profile: Schema.String,
    repository: Schema.String,
    control: Schema.String,
    token: Schema.String,
  }),
  inputs: {
    roots: ['apps/desktop/src', 'apps/desktop/spec/kit', ...webInputs.roots],
    apps: ['apps/desktop', ...webInputs.apps],
  },
  format: 'text',
  stale: (instance, changed) =>
    changed
      ? `The desktop, web, server or CLI code changed since instance ${instance.id} started; run start again so the evidence shows the code you changed.`
      : undefined,
  stopWithinMs: 30_000,
});
function macProblem(): string | undefined {
  return process.platform === 'darwin'
    ? undefined
    : 'The desktop CLI needs macOS: it drives Porcelain Dev, the Mac app, through Playwright Electron. Run it on a Mac (see .agents/skills/desktop-verify/SKILL.md).';
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
): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const timeout = AbortSignal.timeout(quitWithinMs);
  const expired = new Promise<void>((done) => {
    timeout.addEventListener(
      'abort',
      () => {
        process.stderr.write(
          `The app did not quit in ${quitWithinMs} ms; killing process ${child.pid}.\n`,
        );
        child.kill('SIGKILL');
        done();
      },
      { once: true },
    );
  });
  await Promise.race([electron.close(), expired]);
}
function control(
  electron: ElectronApplication,
  token: string,
): Promise<{ address: string; close: () => void }> {
  const server = createHttpServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on('data', (chunk: Buffer) => chunks.push(chunk));
    request.on('end', () => {
      const answer = async () => {
        if (request.headers['x-porcelain-control'] !== token)
          return { status: 403, text: 'Refused: wrong control token\n' };
        const parsed = Schema.decodeUnknownResult(nativeRequestSchema)(
          JSON.parse(Buffer.concat(chunks).toString('utf8')),
        );
        if (!Result.isSuccess(parsed))
          return {
            status: 400,
            text: `${parsed.failure.message}\n`,
          };
        return {
          status: 200,
          text: await nativeCommand(electron, parsed.success),
        };
      };
      answer().then(
        ({ status, text }) => response.writeHead(status).end(text),
        (error: unknown) =>
          response
            .writeHead(500)
            .end(`${error instanceof Error ? error.message : String(error)}\n`),
      );
    });
  });
  return new Promise((done, fail) => {
    server.listen(0, '127.0.0.1', () => {
      const bound = server.address();
      if (typeof bound !== 'object' || bound === null)
        fail(new Error('The control server has no port'));
      else
        done({
          address: `http://127.0.0.1:${bound.port}`,
          close: () => server.close(),
        });
    });
  });
}
function serve(folder: string): Promise<void> {
  return registry.serve(folder, async (life) => {
    const evidence = registry.evidenceFolder(life.id);
    const session = `desktop-${life.id}`;
    const workspace = await realpath(
      await mkdtemp(join('/tmp', 'porcelain-desktop-verify-')),
    );
    const profile = join(workspace, 'profile');
    life.onStop(async () => {
      const log = join(profile, 'logs', 'server.log');
      if (existsSync(log)) await cp(log, join(evidence, 'server.log'));
      await rm(workspace, { recursive: true, force: true });
    });
    const awake = spawn('caffeinate', ['-d', '-u', '-w', String(process.pid)], {
      detached: true,
      stdio: 'ignore',
    });
    if (awake.pid !== undefined) life.own(awake.pid);
    awake.unref();
    await stageDesktop({
      directory: stagedApp,
      productName: 'Porcelain Dev',
      web: true,
    });
    const repository = await sampleRepository(workspace);
    const devtools = await freePort();
    const electron = await _electron.launch(
      launchOptions({
        app: stagedApp,
        profile,
        projectHome: repository,
        switches: [`--remote-debugging-port=${devtools}`],
      }),
    );
    const child = electron.process();
    life.onStop(() => quit(electron, child));
    electron.on('close', () => {
      if (life.stopping()) return;
      life
        .evidence()
        .note(
          'app-exited.txt',
          `Porcelain Dev exited; instance ${life.id} stopped itself.\n`,
        )
        .then(
          () => life.stop('the app exited'),
          () => life.stop('the app exited'),
        );
    });
    child.stderr?.on('data', (chunk: Buffer) => {
      process.stderr.write(chunk);
    });
    const page = await electron.firstWindow();
    await page.waitForURL(
      (url) => url.protocol === 'porcelain:' && url.pathname !== '/pair',
    );
    await nativeCommand(electron, { command: 'hold-picker' });
    life.onStop(() => {
      playwrightCli(session, evidence, ['detach']);
    });
    startBrowser(
      session,
      evidence,
      ['attach', `--cdp=http://127.0.0.1:${devtools}`],
      life.own,
    );
    const token = randomBytes(16).toString('hex');
    life.secret(token);
    const served = await control(electron, token);
    life.onStop(served.close);
    await life
      .evidence()
      .note(
        '000-start.txt',
        `instance ${life.id}\napp ${stagedApp} (Porcelain Dev, unpackaged)\nprofile ${profile}\nrepository ${repository}\nThe native folder picker is held: a picker the app opens waits for dialog <folder> or dialog --cancel.\n`,
      );
    return {
      session,
      workspace,
      profile,
      repository,
      control: served.address,
      token,
    };
  });
}
async function start(): Promise<string> {
  refuseMissing([macProblem() ?? electronProblem()]);
  const started = performance.now();
  const instance = await registry.launch({}, readyWithinMs);
  return `instance ${instance.id}\nevidence ${instance.evidence}\nrepository ${instance.detail.repository}\nprofile ${instance.detail.profile}\nstarted in ${Math.round(performance.now() - started)} ms\n`;
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
    .map(({ instance }) => `${instance.id} ${instance.detail.repository}`);
  return `${checks.join('\n')}\nlive instances: ${live.join(', ') || 'none'}\n`;
}
function nativeRequest(name: string, rest: readonly string[], cancel: boolean) {
  if (name === 'menu')
    return { command: 'menu', path: rest[0] } satisfies NativeRequest;
  if (name === 'window')
    return { command: 'window', change: [...rest] } satisfies NativeRequest;
  if (name === 'dialog')
    return {
      command: 'dialog',
      answer: cancel
        ? { canceled: true, filePaths: [] }
        : rest[0] === undefined
          ? undefined
          : { canceled: false, filePaths: [resolve(rest[0])] },
    } satisfies NativeRequest;
  return undefined;
}
async function command(args: readonly string[]): Promise<string> {
  const { values, positionals } = parseArgs({
    args: [...args],
    options: {
      ...interactionOptions,
      cancel: { type: 'boolean', default: false },
    },
    allowPositionals: true,
    strict: true,
  });
  const [name, ...rest] = positionals;
  if (name === 'serve' && rest[0] !== undefined) {
    await serve(rest[0]);
    return '';
  }
  if (name === 'start') return start();
  if (name === 'doctor') return doctor();
  if (name === 'installed-check') {
    refuseMissing([macProblem()]);
    return checkInstalledApp(
      registry.evidenceFolder(`installed-${randomBytes(4).toString('hex')}`),
    );
  }
  if (name === undefined) throw new Usage(usage);
  const instance = registry.chosen(values.instance, {
    includeStopped: name === 'stop',
  });
  if (name === 'stop') {
    const report = await registry.stop(instance);
    return `${report.map((line) => `${line}\n`).join('')}stopped ${instance.id}\nevidence ${instance.evidence}\n`;
  }
  const evidence = registry.evidence(instance);
  if (name === 'evidence') return evidence.listing();
  return registry.drive(instance, args, async () => {
    const native = nativeRequest(name, rest, values.cancel);
    if (native !== undefined) {
      const response = await fetch(`${instance.detail.control}/`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-porcelain-control': instance.detail.token,
        },
        body: JSON.stringify(native),
      });
      const output = await response.text();
      if (!response.ok) throw new Refusal(output.trim());
      const file = await evidence.record(native.command, args, output);
      return `${registry.redactor(instance).text(output)}\nrecorded ${file}\n`;
    }
    const output = await interact(
      {
        session: instance.detail.session,
        cwd: instance.evidence,
        origin: appOrigin,
        evidence,
        redactor: registry.redactor(instance),
      },
      name,
      rest,
      values,
      args,
    );
    if (output === undefined) throw new Usage(usage);
    return output;
  });
}
await runCli(command);
