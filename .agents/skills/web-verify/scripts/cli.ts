import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { openSync, writeFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import {
  issuePairingResponseSchema,
  pairingLink,
} from '@porcelain/contracts/access';
import { chromium } from 'playwright';
import { z } from 'zod';
import {
  IsolatedServer,
  Recorder,
} from '../../../../apps/server/spec/kit/isolated-server.ts';
import { read } from '../../../../apps/server/spec/kit/requests.ts';
import { buildIsolatedServer } from '../../../../apps/server/spec/kit/sandbox.ts';
import {
  Instances,
  interactionOptions,
  interactionUsage,
  Refusal,
  repositoryRoot as root,
  runCli,
} from './browser.ts';

const self = fileURLToPath(import.meta.url);
const vite = join(root, 'apps/web/node_modules/.bin/vite');
const readyTimeoutMs = 60 * 1000;
const viewport = { width: 414, height: 896 };
const usage = `Usage: .agents/skills/web-verify/scripts/cli <command> [--instance <id>]
  start [--desktop]       start a disposable server, Vite and a paired browser
  doctor                  check the tools and list live instances
  stop                    stop the instance this CLI started; the evidence stays
  evidence                print the evidence folder and what it holds
${interactionUsage}`;

const instances = new Instances(
  'web',
  z.object({
    web: z.string(),
    repository: z.string(),
    projectHome: z.string(),
    desktop: z.boolean(),
  }),
  [
    'apps/web/src',
    'apps/web/index.html',
    'apps/web/vite.config.ts',
    'apps/server/src',
    'packages',
  ],
);

async function chromiumProblem(): Promise<string | undefined> {
  try {
    const launched = await chromium.launch({ headless: true });
    await launched.close();
    return undefined;
  } catch (error) {
    return `Playwright's Chromium does not start (${error instanceof Error ? error.message.split('\n')[0] : String(error)}). Install it with: pnpm exec playwright install chromium`;
  }
}

function sandboxProblem(): string | undefined {
  if (process.platform !== 'linux') return undefined;
  const result = spawnSync('bwrap', ['--version'], { encoding: 'utf8' });
  return result.status === 0
    ? undefined
    : 'The disposable server runs inside bubblewrap on Linux and bwrap is not on PATH. Install it with: sudo apt-get install bubblewrap';
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
          : fail(new Error('No free port for Vite')),
      );
    });
  });
}

async function reachable(url: string, deadline: number): Promise<void> {
  for (;;) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      if (Date.now() > deadline)
        throw new Error(`Vite did not answer ${url} in time`);
    }
    if (Date.now() > deadline)
      throw new Error(`Vite did not answer ${url} in time`);
    await sleep(200);
  }
}

async function serve(
  id: string,
  desktop: boolean,
  evidence: string,
  print: string,
): Promise<void> {
  const build = await mkdtemp(join(tmpdir(), 'porcelain-web-verify-server-'));
  let server: IsolatedServer | undefined;
  let web: ChildProcess | undefined;
  let stopping = false;
  const stop = async () => {
    if (stopping) return;
    stopping = true;
    try {
      instances.browser({ id, evidence }, ['close']);
    } catch {
      process.stderr.write('The browser session was already closed.\n');
    }
    web?.kill('SIGTERM');
    await server?.stop();
    await rm(build, { recursive: true, force: true });
    instances.forget(id);
    process.exit(0);
  };
  process.on('SIGTERM', () => void stop());
  process.on('SIGINT', () => void stop());
  try {
    await buildIsolatedServer(build);
    server = await IsolatedServer.start(root, build);
    const port = await freePort();
    const origin = `http://127.0.0.1:${port}`;
    web = spawn(
      vite,
      [
        '--mode',
        desktop ? 'desktop' : 'test',
        '--host',
        '127.0.0.1',
        '--port',
        String(port),
        '--strictPort',
      ],
      {
        cwd: join(root, 'apps/web'),
        env: { ...process.env, PORCELAIN_API_TARGET: server.address },
        stdio: [
          'ignore',
          openSync(join(evidence, 'vite.log'), 'a'),
          openSync(join(evidence, 'vite.log'), 'a'),
        ],
      },
    );
    await reachable(`${origin}/src/main.tsx`, Date.now() + readyTimeoutMs);
    const config = join(evidence, 'browser.json');
    writeFileSync(
      config,
      `${JSON.stringify({ browser: { browserName: 'chromium', isolated: true, launchOptions: { headless: true }, contextOptions: { viewport } }, outputDir: join(evidence, 'browser') }, null, 2)}\n`,
    );
    instances.browser({ id, evidence }, [
      'open',
      '--config',
      config,
      'about:blank',
    ]);
    const recorder = new Recorder();
    recorder.phase = 'follow-up';
    const owner = server.session(recorder, { projectId: '', worktreeId: '' });
    const [grant] = issuePairingResponseSchema.parse(
      await read(owner, {
        method: 'POST',
        path: '/pairings',
        target: 'owner',
        body: { labels: ['Verification browser'], addresses: [owner.address] },
      }),
    ).grants;
    if (grant === undefined)
      throw new Error('The disposable server issued no pairing grant.');
    instances.browser({ id, evidence }, [
      'goto',
      `${origin}${pairingLink({ addresses: [''], code: grant.link.code, environmentId: grant.link.environmentId })}`,
    ]);
    writeFileSync(
      join(evidence, '000-start.txt'),
      `instance ${id}\nweb ${origin}\nmode ${desktop ? 'desktop' : 'web'}\nrepository ${server.repository}\nproject home ${server.projectHome}\nThe browser opened the app through a one-time pairing link; its code is not recorded.\n`,
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
        web: origin,
        repository: server.repository,
        projectHome: server.projectHome,
        desktop,
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

async function start(desktop: boolean): Promise<string> {
  const problems = [sandboxProblem(), await chromiumProblem()].filter(
    (problem) => problem !== undefined,
  );
  if (problems.length > 0) throw new Refusal(problems.join('\n'));
  const id = randomBytes(3).toString('hex');
  const evidence = instances.evidenceFolder(id);
  const elapsed = await instances.supervise(
    self,
    id,
    [desktop ? 'desktop' : 'web', evidence, instances.fingerprint()],
    readyTimeoutMs * 2,
  );
  const started = instances.chosen(id);
  return `instance ${id}\nweb ${started.detail.web}\nevidence ${evidence}\nrepository ${started.detail.repository}\nstarted in ${elapsed} ms\n`;
}

async function doctor(): Promise<string> {
  const checks = [
    `node ${process.versions.node}`,
    sandboxProblem() ?? 'bubblewrap: ready',
    (await chromiumProblem()) ?? "Playwright's Chromium: ready",
  ];
  const live = instances.live();
  return `${checks.join('\n')}\nlive instances: ${live.map((instance) => `${instance.id} ${instance.detail.web}${instance.detail.desktop ? ' (desktop)' : ''}`).join(', ') || 'none'}\n`;
}

async function command(args: readonly string[]): Promise<string> {
  const { values, positionals } = parseArgs({
    args: [...args],
    options: {
      ...interactionOptions,
      desktop: { type: 'boolean', default: false },
    },
    allowPositionals: true,
    strict: true,
  });
  const [name, ...rest] = positionals;
  if (name === 'serve') {
    const [id = '', mode = 'web', evidence = '', print = ''] = rest;
    await serve(id, mode === 'desktop', evidence, print);
    return '';
  }
  if (name === 'start') return start(values.desktop);
  if (name === 'doctor') return doctor();
  const instance = instances.chosen(values.instance);
  if (name === 'stop') return instances.stop(instance);
  if (name === 'evidence') return instances.listing(instance);
  instances.current(instance, 'The web or server code');
  const output = instances.interact(
    instance,
    instance.detail.web,
    name,
    rest,
    values,
    args,
  );
  if (output === undefined) throw new Refusal(usage);
  return output;
}

await runCli(command);
