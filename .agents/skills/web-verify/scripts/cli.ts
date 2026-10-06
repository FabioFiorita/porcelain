import { Schema } from 'effect';
import { spawn } from 'node:child_process';
import { existsSync, openSync, readFileSync, writeFileSync } from 'node:fs';
import { mkdtemp, rm, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { parseArgs } from 'node:util';
import { pairingLink } from '@porcelain/contracts/access';
import { chromium } from 'playwright';
import {
  IsolatedServer,
  Recorder,
} from '../../../../apps/server/spec/kit/isolated-server.ts';
import {
  prepareRemote,
  REMOTE_COMPUTER_NAME,
} from '../../../../apps/server/spec/kit/remote-computer.ts';
import { pairingGrant } from '../../../../apps/server/spec/kit/requests.ts';
import { buildIsolatedServer } from '../../../../apps/server/spec/kit/sandbox.ts';
import {
  freePort,
  Refusal,
  refuseMissing,
  runCli,
  stopOutput,
  sandboxProblems,
  Usage,
} from '../../verify-core/cli.ts';
import {
  Registry,
  repositoryRoot as root,
  type Instance,
  type Life,
} from '../../verify-core/registry.ts';
import {
  startBrowser,
  interact,
  interactionOptions,
  interactionUsage,
  playwrightCli,
  recorded,
  runCode,
  webInputs,
  type Browser,
} from './browser.ts';
import { installNetwork } from './network.ts';
import {
  agentCommand,
  issuedLink,
  serverOptions,
  serverRead,
  serverUsage,
} from './server.ts';
const vite = join(root, 'apps/web/node_modules/.bin/vite');
const readyTimeoutMs = 60 * 1000;
const remoteReadyMs = 90 * 1000;
const remotePollMs = 200;
const viewport = { width: 414, height: 896 };
const remoteRequest = 'remote-request';
const remoteFailed = 'remote-failed';
const usage = `Usage: .agents/skills/web-verify/scripts/cli <command> [--instance <id>]
  start [--desktop] [--coding-tool] [--unpaired]
                          start a disposable server, Vite and a paired browser;
                          --coding-tool puts the fake claude on the server's PATH,
                          --unpaired leaves the browser on the not-paired page
  doctor                  check the tools and list live instances
  stop                    stop the instance this CLI started; the evidence stays
  evidence                print the evidence folder and what it holds
${interactionUsage}${serverUsage}`;
const remoteSchema = Schema.Struct({
  manifest: Schema.String,
  address: Schema.String,
  repository: Schema.String,
});
const detailSchema = Schema.Struct({
  web: Schema.String,
  session: Schema.String,
  repository: Schema.String,
  projectHome: Schema.String,
  desktop: Schema.Boolean,
  manifest: Schema.String,
  remote: Schema.optional(remoteSchema),
});
const registry = new Registry({
  name: 'web',
  cli: new URL('./cli.ts', import.meta.url).href,
  detail: detailSchema,
  inputs: webInputs,
  format: 'text',
  stale: (instance, changed) =>
    changed
      ? `The web, server or CLI code changed since instance ${instance.id} started; run start again so the evidence shows the code you changed.`
      : undefined,
  stopWithinMs: 20_000,
});
type WebInstance = Instance<typeof detailSchema.Type>;
const startOptions = Schema.Struct({
  desktop: Schema.Boolean,
  codingTool: Schema.Boolean,
  unpaired: Schema.Boolean,
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
function serveRemote(
  folder: string,
  id: string,
  build: string,
  life: Pick<Life, 'secret' | 'onStop'>,
) {
  let started = false;
  const timer = setInterval(() => {
    const request = join(folder, remoteRequest);
    if (started || !existsSync(request)) return;
    started = true;
    clearInterval(timer);
    const startRemote = async () => {
      await unlink(request);
      const remote = await IsolatedServer.start(root, build);
      life.onStop(async () => {
        await remote.stop();
      });
      life.secret(remote.credential, remote.desktopCredential);
      const recorder = new Recorder();
      recorder.phase = 'follow-up';
      await prepareRemote(remote, recorder);
      const current = registry
        .list()
        .find((entry) => entry.instance.id === id)?.instance;
      if (current === undefined) return;
      registry.update(current, (instance) => ({
        ...instance,
        secrets: [
          ...instance.secrets,
          remote.credential,
          remote.desktopCredential,
        ],
        detail: {
          ...instance.detail,
          remote: {
            manifest: remote.manifestPath,
            address: remote.address,
            repository: remote.repository,
          },
        },
      }));
    };
    startRemote().catch((error: unknown) => {
      writeFileSync(
        join(folder, remoteFailed),
        `${error instanceof Error ? error.message : String(error)}\n`,
      );
    });
  }, remotePollMs);
  life.onStop(() => {
    clearInterval(timer);
  });
}
function serve(folder: string): Promise<void> {
  return registry.serve(folder, async (life) => {
    const { desktop, codingTool, unpaired } = Schema.decodeUnknownSync(
      startOptions,
    )(life.options);
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
    const recorder = new Recorder();
    recorder.phase = 'follow-up';
    const owner = server.session(recorder, { projectId: '', worktreeId: '' });
    if (codingTool) await owner.installCodingTool();
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
    life.onStop(() => {
      playwrightCli(session, evidence, ['close']);
    });
    startBrowser(
      session,
      evidence,
      ['open', '--config', config, 'about:blank'],
      life.own,
    );
    runCode(session, evidence, installNetwork);
    if (unpaired) playwrightCli(session, evidence, ['goto', `${origin}/`]);
    else {
      const grant = await pairingGrant(owner, 'Verification browser');
      life.secret(grant.code);
      playwrightCli(session, evidence, [
        'goto',
        `${origin}${pairingLink({ addresses: [''], code: grant.code, environmentId: grant.environmentId })}`,
      ]);
    }
    serveRemote(folder, life.id, build, life);
    await life
      .evidence()
      .note(
        '000-start.txt',
        `instance ${life.id}\nweb ${origin}\nmode ${desktop ? 'desktop' : 'web'}\nrepository ${server.repository}\nproject home ${server.projectHome}\ncoding tool ${codingTool ? server.fixture.codingTool.command : 'none'}\n${unpaired ? 'The browser is not paired.' : 'The browser opened the app through a one-time pairing link; its code is not recorded.'}\n`,
      );
    return {
      web: origin,
      session,
      repository: server.repository,
      projectHome: server.projectHome,
      desktop,
      manifest: server.manifestPath,
    };
  });
}
async function start(options: typeof startOptions.Encoded): Promise<string> {
  refuseMissing([...sandboxProblems(), await chromiumProblem()]);
  const started = performance.now();
  const instance = await registry.launch(options, readyTimeoutMs * 2);
  return `instance ${instance.id}\nweb ${instance.detail.web}\nevidence ${instance.evidence}\nrepository ${instance.detail.repository}\n${options.codingTool ? 'coding tool claude (the kit fake) on the server PATH\n' : ''}${options.unpaired ? 'browser not paired\n' : ''}started in ${Math.round(performance.now() - started)} ms\n`;
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
function remoteOf(instance: WebInstance) {
  const { remote } = instance.detail;
  if (remote === undefined)
    throw new Refusal('No second computer runs yet; run remote start first.');
  return remote;
}
async function remoteStart(instance: WebInstance): Promise<string> {
  const describe = (remote: typeof remoteSchema.Type) =>
    `remote computer ${REMOTE_COMPUTER_NAME}, project remote-sample\nremote address ${remote.address}\nremote repository ${remote.repository}\n`;
  if (instance.detail.remote !== undefined)
    return `already running\n${describe(instance.detail.remote)}`;
  const failed = join(instance.folder, remoteFailed);
  writeFileSync(join(instance.folder, remoteRequest), '');
  const deadline = Date.now() + remoteReadyMs;
  while (Date.now() < deadline) {
    if (existsSync(failed))
      throw new Refusal(
        `the second computer did not start: ${readFileSync(failed, 'utf8').trim()}`,
      );
    const remote = registry
      .list()
      .find((entry) => entry.instance.id === instance.id)?.instance
      .detail.remote;
    if (remote !== undefined) return describe(remote);
    await sleep(remotePollMs);
  }
  throw new Refusal(
    `the second computer did not start within ${remoteReadyMs / 1000} s; read supervisor.log`,
  );
}
type ServerSideValues = Parameters<typeof agentCommand>[2] & {
  remote: boolean;
  trusted: boolean;
};
async function serverSide(
  instance: WebInstance,
  browser: Browser,
  name: string,
  rest: readonly string[],
  values: ServerSideValues,
  args: readonly string[],
): Promise<string | undefined> {
  const manifest = () =>
    values.remote ? remoteOf(instance).manifest : instance.detail.manifest;
  const record = (label: string, output: string) =>
    recorded(browser, label, args, output);
  if (name === 'agent')
    return record(
      `agent-${rest[0] ?? ''}`,
      await agentCommand(manifest(), rest, values),
    );
  if (name === 'server')
    return record(
      `server-${rest[0] ?? ''}`,
      await serverRead(manifest(), rest),
    );
  if (name === 'pair') {
    const grant = await issuedLink(
      instance.detail.manifest,
      'Verification browser',
      false,
    );
    return record(
      'pair',
      playwrightCli(browser.session, browser.cwd, [
        'goto',
        `${instance.detail.web}${pairingLink({ addresses: [''], code: grant.code, environmentId: grant.environmentId })}`,
      ]),
    );
  }
  if (name === 'remote' && rest[0] === 'start')
    return record('remote-start', await remoteStart(instance));
  if (name === 'remote' && rest[0] === 'pairing-link') {
    const grant = await issuedLink(
      remoteOf(instance).manifest,
      'Remote computer',
      values.trusted,
    );
    const link = pairingLink({
      addresses: [grant.address],
      code: grant.code,
      environmentId: grant.environmentId,
    });
    const file = await browser.evidence.record(
      'remote-pairing-link',
      args,
      `${link}\n`,
    );
    return `${link}\nrecorded ${file}\n`;
  }
  return undefined;
}
async function command(args: readonly string[]): Promise<string> {
  const { values, positionals } = parseArgs({
    args: [...args],
    options: {
      ...interactionOptions,
      ...serverOptions,
      desktop: { type: 'boolean', default: false },
      'coding-tool': { type: 'boolean', default: false },
      unpaired: { type: 'boolean', default: false },
    },
    allowPositionals: true,
    strict: true,
  });
  const [name, ...rest] = positionals;
  if (name === 'serve' && rest[0] !== undefined) {
    await serve(rest[0]);
    return '';
  }
  if (name === 'start')
    return start({
      desktop: values.desktop,
      codingTool: values['coding-tool'],
      unpaired: values.unpaired,
    });
  if (name === 'doctor') return doctor();
  if (name === undefined) throw new Usage(usage);
  if (name === 'stop') {
    const result = await registry.stopById(values.instance);
    return stopOutput(result);
  }
  if (name === 'evidence')
    return registry
      .evidence({
        evidence: registry.evidencePath(values.instance),
        secrets: [],
      })
      .listing();
  const instance = registry.chosen(values.instance);
  const evidence = registry.evidence(instance);
  return registry.drive(instance, args, async () => {
    const browser: Browser = {
      session: instance.detail.session,
      cwd: instance.evidence,
      origin: instance.detail.web,
      evidence,
      redactor: registry.redactor(instance),
    };
    const output =
      (await serverSide(instance, browser, name, rest, values, args)) ??
      (await interact(browser, name, rest, values, args));
    if (output === undefined) throw new Usage(usage);
    return output;
  });
}
await runCli(command);
