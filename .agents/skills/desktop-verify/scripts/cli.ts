import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, writeFileSync } from 'node:fs';
import { cp, mkdtemp, realpath, rm } from 'node:fs/promises';
import { createServer as createHttpServer } from 'node:http';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { launchOptions, sampleRepository } from '@porcelain/desktop/kit/launch';
import { electronExecutable, stageDesktop } from '@porcelain/desktop/kit/stage';
import { _electron, type ElectronApplication } from 'playwright';
import { z } from 'zod';
import {
  Instances,
  interactionOptions,
  interactionUsage,
  Refusal,
  repositoryRoot as root,
  runCli,
} from '../../web-verify/scripts/browser.ts';
import { checkInstalledApp } from './installed.ts';
import {
  nativeCommand,
  nativeRequestSchema,
  type NativeRequest,
} from './native.ts';

const self = fileURLToPath(import.meta.url);
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

const instances = new Instances(
  'desktop',
  z.object({
    workspace: z.string(),
    profile: z.string(),
    repository: z.string(),
    control: z.string(),
    token: z.string(),
  }),
  [
    'apps/desktop/src',
    'apps/desktop/spec/kit',
    'apps/web/src',
    'apps/web/index.html',
    'apps/web/vite.config.ts',
    'apps/server/src',
    'packages',
  ],
);

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

function freePort(): Promise<number> {
  return new Promise((done, fail) => {
    const probe = createServer();
    probe.once('error', fail);
    probe.listen(0, '127.0.0.1', () => {
      const bound = probe.address();
      probe.close(() =>
        typeof bound === 'object' && bound !== null
          ? done(bound.port)
          : fail(new Error('No free port for the DevTools endpoint')),
      );
    });
  });
}

async function quit(electron: ElectronApplication): Promise<void> {
  const child = electron.process();
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
        const parsed = nativeRequestSchema.safeParse(
          JSON.parse(Buffer.concat(chunks).toString('utf8')),
        );
        if (!parsed.success)
          return { status: 400, text: `${parsed.error.message}\n` };
        return {
          status: 200,
          text: await nativeCommand(electron, parsed.data),
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

async function serve(id: string, evidence: string, print: string) {
  const workspace = await realpath(
    await mkdtemp(join(tmpdir(), 'porcelain-desktop-verify-')),
  );
  let electron: ElectronApplication | undefined;
  let closeControl: (() => void) | undefined;
  let stopping = false;
  const stop = async () => {
    if (stopping) return;
    stopping = true;
    try {
      instances.browser({ id, evidence }, ['detach']);
    } catch {
      process.stderr.write('The browser session was already detached.\n');
    }
    closeControl?.();
    if (electron !== undefined) await quit(electron);
    const log = join(workspace, 'profile', 'logs', 'server.log');
    if (existsSync(log)) await cp(log, join(evidence, 'server.log'));
    await rm(workspace, { recursive: true, force: true });
    instances.forget(id);
    process.exit(0);
  };
  process.on('SIGTERM', () => void stop());
  process.on('SIGINT', () => void stop());
  try {
    spawn('caffeinate', ['-d', '-u', '-w', String(process.pid)], {
      detached: true,
      stdio: 'ignore',
    }).unref();
    await stageDesktop({
      directory: stagedApp,
      productName: 'Porcelain Dev',
      web: true,
    });
    const repository = await sampleRepository(workspace);
    const profile = join(workspace, 'profile');
    const devtools = await freePort();
    electron = await _electron.launch(
      launchOptions({
        app: stagedApp,
        profile,
        projectHome: repository,
        switches: [`--remote-debugging-port=${devtools}`],
      }),
    );
    electron.on('close', () => {
      writeFileSync(
        join(evidence, 'app-exited.txt'),
        `Porcelain Dev exited; instance ${id} stopped itself.\n`,
      );
      void stop();
    });
    electron.process().stderr?.on('data', (chunk: Buffer) => {
      process.stderr.write(chunk);
    });
    const page = await electron.firstWindow();
    await page.waitForURL(
      (url) => url.protocol === 'porcelain:' && url.pathname !== '/pair',
    );
    await nativeCommand(electron, { command: 'hold-picker' });
    instances.browser({ id, evidence }, [
      'attach',
      `--cdp=http://127.0.0.1:${devtools}`,
    ]);
    const token = randomBytes(16).toString('hex');
    const served = await control(electron, token);
    closeControl = served.close;
    writeFileSync(
      join(evidence, '000-start.txt'),
      `instance ${id}\napp ${stagedApp} (Porcelain Dev, unpackaged)\nprofile ${profile}\nrepository ${repository}\nThe native folder picker is held: a picker the app opens waits for dialog <folder> or dialog --cancel.\n`,
    );
    instances.save({
      id,
      pid: process.pid,
      evidence,
      fingerprint: print,
      startedAt: new Date().toISOString(),
      lastCommandAt: Date.now(),
      commands: 0,
      detail: {
        workspace,
        profile,
        repository,
        control: served.address,
        token,
      },
    });
  } catch (error) {
    writeFileSync(
      join(evidence, 'start-failed.txt'),
      `${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`,
    );
    await stop();
    return;
  }
  await instances.idle(id, evidence, stop);
}

async function start(): Promise<string> {
  const problems = [macProblem(), electronProblem()].filter(
    (problem) => problem !== undefined,
  );
  if (problems.length > 0) throw new Refusal(problems.join('\n'));
  const id = randomBytes(3).toString('hex');
  const evidence = instances.evidenceFolder(id);
  const elapsed = await instances.supervise(
    self,
    id,
    [evidence, instances.fingerprint()],
    readyWithinMs,
  );
  const started = instances.chosen(id);
  return `instance ${id}\nevidence ${evidence}\nrepository ${started.detail.repository}\nprofile ${started.detail.profile}\nstarted in ${elapsed} ms\n`;
}

function doctor(): string {
  const checks = [
    `node ${process.versions.node}`,
    macProblem() ?? 'macOS: ready',
    electronProblem() ?? `Electron: ${electronExecutable()}`,
  ];
  const live = instances.live();
  return `${checks.join('\n')}\nlive instances: ${live.map((instance) => `${instance.id} ${instance.detail.repository}`).join(', ') || 'none'}\n`;
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
  if (name === 'serve') {
    const [id = '', evidence = '', print = ''] = rest;
    await serve(id, evidence, print);
    return '';
  }
  if (name === 'start') return start();
  if (name === 'doctor') return doctor();
  if (name === 'installed-check') {
    const problem = macProblem();
    if (problem !== undefined) throw new Refusal(problem);
    return checkInstalledApp(
      join(
        instances.home,
        'evidence',
        `installed-${randomBytes(3).toString('hex')}`,
      ),
    );
  }
  const instance = instances.chosen(values.instance);
  if (name === 'stop') return instances.stop(instance);
  if (name === 'evidence') return instances.listing(instance);
  instances.current(instance, 'The desktop, web or server code');
  const native =
    name === undefined ? undefined : nativeRequest(name, rest, values.cancel);
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
    return `${output}\nrecorded ${instances.record(instance, native.command, args, output)}\n`;
  }
  const output = instances.interact(
    instance,
    appOrigin,
    name,
    rest,
    values,
    args,
  );
  if (output === undefined) throw new Refusal(usage);
  return output;
}

await runCli(command);
