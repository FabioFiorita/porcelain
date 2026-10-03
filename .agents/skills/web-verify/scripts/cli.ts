import { spawn } from 'node:child_process';
import { openSync, writeFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
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
  freePort,
  refuseMissing,
  runCli,
  sandboxProblems,
  Usage,
} from '../../server-verify/scripts/core/cli.ts';
import {
  Registry,
  repositoryRoot as root,
} from '../../server-verify/scripts/core/registry.ts';
import {
  daemonMarker,
  interact,
  interactionOptions,
  interactionUsage,
  playwrightCli,
  webInputs,
} from './browser.ts';

const vite = join(root, 'apps/web/node_modules/.bin/vite');
const readyTimeoutMs = 60 * 1000;
const viewport = { width: 414, height: 896 };
const usage = `Usage: .agents/skills/web-verify/scripts/cli <command> [--instance <id>]
  start [--desktop]       start a disposable server, Vite and a paired browser
  doctor                  check the tools and list live instances
  stop                    stop the instance this CLI started; the evidence stays
  evidence                print the evidence folder and what it holds
${interactionUsage}`;

const registry = new Registry({
  name: 'web',
  cli: new URL('./cli.ts', import.meta.url).href,
  detail: z.object({
    web: z.string(),
    session: z.string(),
    repository: z.string(),
    projectHome: z.string(),
    desktop: z.boolean(),
  }),
  inputs: webInputs,
  format: 'text',
  stale: (instance, changed) =>
    changed
      ? `The web, server or CLI code changed since instance ${instance.id} started; run start again so the evidence shows the code you changed.`
      : undefined,
  stopWithinMs: 20_000,
});

async function chromiumProblem(): Promise<string | undefined> {
  try {
    const launched = await chromium.launch({ headless: true });
    await launched.close();
    return undefined;
  } catch (error) {
    return `Playwright's Chromium does not start (${error instanceof Error ? error.message.split('\n')[0] : String(error)}). Install it with: pnpm exec playwright install chromium`;
  }
}

async function reachable(url: string, deadline: number): Promise<void> {
  for (;;) {
    const answered = await fetch(url).then(
      (response) => response.ok,
      () => false,
    );
    if (answered) return;
    if (Date.now() > deadline)
      throw new Error(`Vite did not answer ${url} in time`);
    await sleep(200);
  }
}

function serve(folder: string): Promise<void> {
  return registry.serve(folder, async (life) => {
    const { desktop } = z.object({ desktop: z.boolean() }).parse(life.options);
    const evidence = registry.evidenceFolder(life.id);
    const session = `web-${life.id}`;
    const build = await mkdtemp(join(tmpdir(), 'porcelain-web-verify-server-'));
    life.onStop(() => rm(build, { recursive: true, force: true }));
    await buildIsolatedServer(build);
    const server = await IsolatedServer.start(root, build);
    life.onStop(async () => {
      await server.stop();
    });
    life.secret(server.credential, server.desktopCredential);
    const port = await freePort();
    const origin = `http://127.0.0.1:${port}`;
    const log = openSync(join(evidence, 'vite.log'), 'a');
    const web = spawn(
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
        stdio: ['ignore', log, log],
      },
    );
    life.onStop(() => {
      web.kill('SIGTERM');
    });
    await reachable(`${origin}/src/main.tsx`, Date.now() + readyTimeoutMs);
    const config = join(evidence, 'browser.json');
    writeFileSync(
      config,
      `${JSON.stringify({ browser: { browserName: 'chromium', isolated: true, launchOptions: { headless: true }, contextOptions: { viewport } }, outputDir: join(evidence, 'browser') }, null, 2)}\n`,
    );
    life.marker(daemonMarker(session));
    life.onStop(() => {
      playwrightCli(session, evidence, ['close']);
    });
    playwrightCli(session, evidence, [
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
    life.secret(grant.link.code);
    playwrightCli(session, evidence, [
      'goto',
      `${origin}${pairingLink({ addresses: [''], code: grant.link.code, environmentId: grant.link.environmentId })}`,
    ]);
    await life
      .evidence()
      .note(
        '000-start.txt',
        `instance ${life.id}\nweb ${origin}\nmode ${desktop ? 'desktop' : 'web'}\nrepository ${server.repository}\nproject home ${server.projectHome}\nThe browser opened the app through a one-time pairing link; its code is not recorded.\n`,
      );
    return {
      web: origin,
      session,
      repository: server.repository,
      projectHome: server.projectHome,
      desktop,
    };
  });
}

async function start(desktop: boolean): Promise<string> {
  refuseMissing([...sandboxProblems(), await chromiumProblem()]);
  const started = performance.now();
  const instance = await registry.launch({ desktop }, readyTimeoutMs * 2);
  return `instance ${instance.id}\nweb ${instance.detail.web}\nevidence ${instance.evidence}\nrepository ${instance.detail.repository}\nstarted in ${Math.round(performance.now() - started)} ms\n`;
}

async function doctor(): Promise<string> {
  const sandbox = sandboxProblems();
  const checks = [
    `node ${process.versions.node}`,
    ...(sandbox.length > 0 ? sandbox : ['server sandbox and Git: ready']),
    (await chromiumProblem()) ?? "Playwright's Chromium: ready",
  ];
  const live = registry
    .list()
    .filter((entry) => entry.alive)
    .map(
      ({ instance }) =>
        `${instance.id} ${instance.detail.web}${instance.detail.desktop ? ' (desktop)' : ''}`,
    );
  return `${checks.join('\n')}\nlive instances: ${live.join(', ') || 'none'}\n`;
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
  if (name === 'serve' && rest[0] !== undefined) {
    await serve(rest[0]);
    return '';
  }
  if (name === 'start') return start(values.desktop);
  if (name === 'doctor') return doctor();
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
    const output = await interact(
      {
        session: instance.detail.session,
        cwd: instance.evidence,
        origin: instance.detail.web,
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
