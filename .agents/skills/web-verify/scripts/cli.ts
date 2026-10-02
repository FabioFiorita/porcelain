import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
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

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const self = fileURLToPath(import.meta.url);
const home = join(tmpdir(), 'porcelain-web-verify');
const instances = join(home, 'instances');
const playwright = join(root, 'node_modules/.bin/playwright');
const vite = join(root, 'apps/web/node_modules/.bin/vite');
const idleLimitMs = 30 * 60 * 1000;
const idlePollMs = 30 * 1000;
const readyTimeoutMs = 60 * 1000;
const watched = [
  'apps/web/src',
  'apps/web/index.html',
  'apps/web/vite.config.ts',
  'apps/server/src',
  'packages',
];
const viewport = { width: 414, height: 896 };
const usage = `Usage: .agents/skills/web-verify/scripts/cli <command> [--instance <id>]
  start [--desktop]       start a disposable server, Vite and a paired browser
  doctor                  check the tools and list live instances
  stop                    stop the instance this CLI started; the evidence stays
  evidence                print the evidence folder and what it holds
  open <route>            open a route of the web app
  click <address> [--button right]
  fill <address> <value>  address is --role <role> --name <name>, --testid <id> or --text <text>
  press <key>             press a key, such as Escape or ControlOrMeta+p
  snapshot                record the accessibility tree as Playwright's aria snapshot
  screenshot              record a screenshot
  console                 record the console messages
  network                 record the requests the page sent
  trace start|stop        record a Chrome performance trace through CDP
`;

const instanceSchema = z.object({
  id: z.string(),
  pid: z.number(),
  web: z.string(),
  evidence: z.string(),
  repository: z.string(),
  projectHome: z.string(),
  desktop: z.boolean(),
  fingerprint: z.string(),
  startedAt: z.string(),
  lastCommandAt: z.number(),
  commands: z.number(),
});

type Instance = z.output<typeof instanceSchema>;

class Refusal extends Error {}

function instanceFile(id: string): string {
  return join(instances, `${id}.json`);
}

function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function liveInstances(): Instance[] {
  if (!existsSync(instances)) return [];
  return readdirSync(instances)
    .filter((file) => file.endsWith('.json'))
    .flatMap((file) => {
      const parsed = instanceSchema.safeParse(
        JSON.parse(readFileSync(join(instances, file), 'utf8')),
      );
      if (!parsed.success || !alive(parsed.data.pid)) return [];
      return [parsed.data];
    });
}

function saveInstance(instance: Instance): void {
  mkdirSync(instances, { recursive: true });
  writeFileSync(
    instanceFile(instance.id),
    `${JSON.stringify(instance, null, 2)}\n`,
  );
}

function filesOf(path: string): string[] {
  const absolute = join(root, path);
  if (!existsSync(absolute)) return [];
  if (!statSync(absolute).isDirectory()) return [path];
  return readdirSync(absolute, { withFileTypes: true }).flatMap((entry) =>
    entry.name === 'node_modules' || entry.name === 'dist'
      ? []
      : filesOf(join(path, entry.name)),
  );
}

function fingerprint(): string {
  const hash = createHash('sha256');
  for (const file of watched.flatMap(filesOf).toSorted()) {
    const stat = statSync(join(root, file));
    hash.update(`${file}\0${stat.size}\0${stat.mtimeMs}\n`);
  }
  return hash.digest('hex');
}

function chosen(id: string | undefined): Instance {
  const live = liveInstances();
  if (id !== undefined) {
    const named = live.find((instance) => instance.id === id);
    if (named === undefined)
      throw new Refusal(
        `No live instance is named ${id}; live: ${live.map((instance) => instance.id).join(', ') || 'none'}.`,
      );
    return named;
  }
  if (live.length === 0)
    throw new Refusal('No live instance; run start first.');
  if (live.length > 1)
    throw new Refusal(
      `Several instances are live (${live.map((instance) => instance.id).join(', ')}); pass --instance <id>.`,
    );
  const [only] = live;
  if (only === undefined)
    throw new Refusal('No live instance; run start first.');
  return only;
}

function current(instance: Instance): void {
  if (instance.fingerprint !== fingerprint())
    throw new Refusal(
      `The web or server code changed since instance ${instance.id} started; run start again so the evidence shows the code you changed.`,
    );
}

function record(
  instance: Instance,
  name: string,
  args: readonly string[],
  output: string,
): string {
  const number = instance.commands + 1;
  const file = join(
    instance.evidence,
    `${String(number).padStart(3, '0')}-${name}.txt`,
  );
  writeFileSync(file, `$ cli ${args.join(' ')}\n\n${output}`);
  saveInstance({ ...instance, commands: number, lastCommandAt: Date.now() });
  return file;
}

function nextFile(instance: Instance, name: string, extension: string): string {
  return join(
    instance.evidence,
    `${String(instance.commands + 1).padStart(3, '0')}-${name}.${extension}`,
  );
}

function browser(
  instance: Pick<Instance, 'id' | 'evidence'>,
  args: readonly string[],
): string {
  const result = spawnSync(playwright, ['cli', `-s=${instance.id}`, ...args], {
    cwd: instance.evidence,
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  const output = `${result.stdout}${result.stderr}`;
  if (result.status !== 0)
    throw new Refusal(
      output.trim() || `playwright cli ${args[0] ?? ''} failed`,
    );
  return output;
}

function quoted(value: string): string {
  return /^\/.+\/[a-z]*$/.test(value)
    ? value
    : `'${value.replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`;
}

function address(values: {
  role?: string | undefined;
  name?: string | undefined;
  testid?: string | undefined;
  text?: string | undefined;
}): string {
  if (values.testid !== undefined)
    return `getByTestId(${quoted(values.testid)})`;
  if (values.text !== undefined)
    return values.text.startsWith('/')
      ? `getByText(${quoted(values.text)})`
      : `getByText(${quoted(values.text)}, { exact: true })`;
  if (values.role === undefined)
    throw new Refusal(
      'Address the element with --role <role> --name <name>, --testid <id> or --text <text>.',
    );
  if (values.name === undefined) return `getByRole(${quoted(values.role)})`;
  return values.name.startsWith('/')
    ? `getByRole(${quoted(values.role)}, { name: ${quoted(values.name)} })`
    : `getByRole(${quoted(values.role)}, { name: ${quoted(values.name)}, exact: true })`;
}

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
      browser({ id, evidence }, ['close']);
    } catch {
      process.stderr.write('The browser session was already closed.\n');
    }
    web?.kill('SIGTERM');
    await server?.stop();
    await rm(build, { recursive: true, force: true });
    rmSync(instanceFile(id), { force: true });
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
    browser({ id, evidence }, ['open', '--config', config, 'about:blank']);
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
    browser({ id, evidence }, [
      'goto',
      `${origin}${pairingLink({ addresses: [''], code: grant.link.code, environmentId: grant.link.environmentId })}`,
    ]);
    writeFileSync(
      join(evidence, '000-start.txt'),
      `instance ${id}\nweb ${origin}\nmode ${desktop ? 'desktop' : 'web'}\nrepository ${server.repository}\nproject home ${server.projectHome}\nThe browser opened the app through a one-time pairing link; its code is not recorded.\n`,
    );
    saveInstance({
      id,
      pid: process.pid,
      web: origin,
      evidence,
      repository: server.repository,
      projectHome: server.projectHome,
      desktop,
      fingerprint: print,
      startedAt: new Date().toISOString(),
      lastCommandAt: Date.now(),
      commands: 0,
    });
  } catch (error) {
    writeFileSync(
      join(evidence, 'start-failed.txt'),
      `${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`,
    );
    await stop();
    return;
  }
  for (;;) {
    await sleep(idlePollMs);
    const saved = existsSync(instanceFile(id))
      ? instanceSchema.safeParse(
          JSON.parse(readFileSync(instanceFile(id), 'utf8')),
        )
      : undefined;
    if (
      saved === undefined ||
      !saved.success ||
      Date.now() - saved.data.lastCommandAt > idleLimitMs
    ) {
      writeFileSync(
        join(evidence, 'idle-stop.txt'),
        `No command reached instance ${id} for 30 minutes; it stopped itself.\n`,
      );
      await stop();
    }
  }
}

async function start(desktop: boolean): Promise<string> {
  const problems = [sandboxProblem(), await chromiumProblem()].filter(
    (problem) => problem !== undefined,
  );
  if (problems.length > 0) throw new Refusal(problems.join('\n'));
  const id = randomBytes(3).toString('hex');
  const evidence = join(home, 'evidence', id);
  mkdirSync(evidence, { recursive: true });
  mkdirSync(instances, { recursive: true });
  const started = performance.now();
  const supervisor = spawn(
    process.execPath,
    [self, 'serve', id, desktop ? 'desktop' : 'web', evidence, fingerprint()],
    {
      cwd: root,
      detached: true,
      stdio: [
        'ignore',
        openSync(join(evidence, 'supervisor.log'), 'a'),
        openSync(join(evidence, 'supervisor.log'), 'a'),
      ],
    },
  );
  supervisor.unref();
  const deadline = Date.now() + readyTimeoutMs * 2;
  while (!existsSync(instanceFile(id))) {
    if (
      supervisor.pid === undefined ||
      !alive(supervisor.pid) ||
      Date.now() > deadline
    ) {
      const failed = join(evidence, 'start-failed.txt');
      throw new Refusal(
        `Instance ${id} did not start: ${existsSync(failed) ? readFileSync(failed, 'utf8').split('\n')[0] : 'read the supervisor log'}. Evidence: ${evidence}`,
      );
    }
    await sleep(100);
  }
  return `instance ${id}\nweb ${chosen(id).web}\nevidence ${evidence}\nrepository ${chosen(id).repository}\nstarted in ${Math.round(performance.now() - started)} ms\n`;
}

async function stopInstance(instance: Instance): Promise<string> {
  process.kill(instance.pid, 'SIGTERM');
  const deadline = Date.now() + 20_000;
  while (alive(instance.pid) && Date.now() < deadline) await sleep(100);
  if (alive(instance.pid))
    throw new Refusal(
      `Instance ${instance.id} (pid ${instance.pid}) did not stop in 20 seconds; the evidence stays in ${instance.evidence}.`,
    );
  return `stopped ${instance.id}\nevidence ${instance.evidence}\n`;
}

function evidenceListing(instance: Instance): string {
  return `${instance.evidence}\n${readdirSync(instance.evidence)
    .toSorted()
    .map((file) => `  ${file}`)
    .join('\n')}\n`;
}

async function doctor(): Promise<string> {
  const checks = [
    `node ${process.versions.node}`,
    sandboxProblem() ?? 'bubblewrap: ready',
    (await chromiumProblem()) ?? "Playwright's Chromium: ready",
  ];
  const live = liveInstances();
  return `${checks.join('\n')}\nlive instances: ${live.map((instance) => `${instance.id} ${instance.web}${instance.desktop ? ' (desktop)' : ''}`).join(', ') || 'none'}\n`;
}

async function command(args: readonly string[]): Promise<string> {
  const { values, positionals } = parseArgs({
    args: [...args],
    options: {
      instance: { type: 'string' },
      desktop: { type: 'boolean', default: false },
      role: { type: 'string' },
      name: { type: 'string' },
      testid: { type: 'string' },
      text: { type: 'string' },
      button: { type: 'string' },
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
  const instance = chosen(values.instance);
  if (name === 'stop') return stopInstance(instance);
  if (name === 'evidence') return evidenceListing(instance);
  current(instance);
  if (name === 'open') {
    const route = rest[0] ?? '/';
    return `${browser(instance, ['goto', `${instance.web}${route.startsWith('/') ? route : `/${route}`}`])}\nrecorded ${record(instance, 'open', args, '')}\n`;
  }
  if (name === 'click' || name === 'fill') {
    const target = address(values);
    const output =
      name === 'click'
        ? browser(instance, [
            'click',
            target,
            ...(values.button === undefined ? [] : [values.button]),
          ])
        : browser(instance, ['fill', target, rest[0] ?? '']);
    return `${output}\nrecorded ${record(instance, name, args, output)}\n`;
  }
  if (name === 'press') {
    const output = browser(instance, ['press', rest[0] ?? 'Enter']);
    return `${output}\nrecorded ${record(instance, 'press', args, output)}\n`;
  }
  if (name === 'snapshot') {
    const file = nextFile(instance, 'snapshot', 'yml');
    const tree = z
      .string()
      .parse(
        JSON.parse(
          browser(instance, [
            '--raw',
            'run-code',
            "async page => page.locator('body').ariaSnapshot()",
          ]),
        ),
      );
    writeFileSync(file, `${tree}\n`);
    record(instance, 'snapshot', args, `aria snapshot in ${file}\n`);
    return `${tree}\nrecorded ${file}\n`;
  }
  if (name === 'screenshot') {
    const file = nextFile(instance, 'screenshot', 'png');
    browser(instance, ['screenshot', '--filename', file]);
    record(instance, 'screenshot', args, `screenshot in ${file}\n`);
    return `recorded ${file}\n`;
  }
  if (name === 'console' || name === 'network') {
    const output = browser(instance, [
      '--raw',
      name === 'console' ? 'console' : 'requests',
    ]);
    return `${output}\nrecorded ${record(instance, name, args, output)}\n`;
  }
  if (name === 'trace' && rest[0] === 'start') {
    browser(instance, [
      '--raw',
      'run-code',
      'async page => { await page.context().browser().startTracing(page, { screenshots: true }); return "tracing"; }',
    ]);
    return `tracing\nrecorded ${record(instance, 'trace-start', args, 'Chrome performance trace started\n')}\n`;
  }
  if (name === 'trace' && rest[0] === 'stop') {
    const encoded = browser(instance, [
      '--raw',
      'run-code',
      'async page => (await page.context().browser().stopTracing()).toString("base64")',
    ]);
    const file = nextFile(instance, 'trace', 'json');
    writeFileSync(
      file,
      Buffer.from(z.string().parse(JSON.parse(encoded)), 'base64'),
    );
    record(
      instance,
      'trace-stop',
      args,
      `Chrome performance trace in ${file}; open it in the Performance panel of Chrome DevTools\n`,
    );
    return `recorded ${file}\n`;
  }
  throw new Refusal(usage);
}

try {
  process.stdout.write(await command(process.argv.slice(2)));
} catch (error) {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = error instanceof Refusal ? 2 : 1;
}
