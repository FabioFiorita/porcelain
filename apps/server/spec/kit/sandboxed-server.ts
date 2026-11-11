import {
  prepareWalkthroughSample,
  seedWalkthroughSample,
} from './walkthrough-sample.ts';
import { readInventoryResponseSchema } from '@porcelain/contracts/projects';
import { ghPullRequestReaderLayer } from '../../src/adapters/reviews/gh-pull-request-reader.ts';
import { OffsetClock } from './offset-clock.ts';
import { createInterface } from 'node:readline';
import {
  Clock,
  Duration,
  Effect,
  Layer,
  ManagedRuntime,
  Schema,
  Scope,
} from 'effect';
import { NodeServices } from '@effect/platform-node';
import { ownerClient, ownerRequest } from '../../src/cli/owner-client.ts';
import { execFile } from 'node:child_process';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { subscribe } from 'node:diagnostics_channel';
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { readServiceUpdateResponseSchema } from '@porcelain/contracts/access';
import {
  mkdir,
  readFile,
  readdir,
  readlink,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { connect, createServer } from 'node:net';
import { join } from 'node:path';
import { inspect, promisify } from 'node:util';
import { FixedNetworkAddressReader } from '../fakes/fixed-network-address-reader.ts';
import { InMemoryRouteListenerRunner } from '../fakes/in-memory-route-listener-runner.ts';
import { ScriptedServiceUpdateRunner } from '../fakes/scripted-service-update-runner.ts';
import { ScriptedTunnelProbe } from '../fakes/scripted-tunnel-probe.ts';
import { composeServer } from '../../src/bootstrap/compose-server.ts';
import {
  readServerSettings,
  listenHostSchema,
} from '../../src/config/server-settings.ts';
import type { Runtime } from '../../src/ports/runtime.ts';
import { codingTool } from './coding-tool.ts';
const issuedPairingSchema = Schema.Struct({
  grants: Schema.Array(
    Schema.Struct({
      code: Schema.String,
    }),
  ),
});
const redeemedPairingSchema = Schema.Struct({
  credential: Schema.optional(Schema.String),
});
const healthSchema = Schema.Struct({
  environmentId: Schema.String,
});
const execute = promisify(execFile);
const shutdown = new AbortController();
const stop = () => shutdown.abort();
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
process.stdin.on('end', stop);
process.stdin.resume();
const root = process.env.PORCELAIN_DEV_ROOT;
if (!root) throw new Error('Missing development root');
const port = Number(process.env.PORCELAIN_DEV_PORT ?? '0');
const bin = process.env.PORCELAIN_DEV_BIN;
if (!bin) throw new Error('Missing development PATH folder');
const installation = process.env.PORCELAIN_DEV_INSTALLATION;
if (!installation) throw new Error('Missing development installation folder');
const codingToolExecutable = process.env.PORCELAIN_DEV_CODING_TOOL;
if (!codingToolExecutable)
  throw new Error('Missing development coding tool location');
const clock =
  process.env.PORCELAIN_TEST_CLOCK === '1'
    ? new OffsetClock(Effect.runSync(Clock.Clock))
    : undefined;
const control = clock ? createInterface({ input: process.stdin }) : undefined;
if (clock && control)
  control.on('line', (line) => {
    const command = Schema.decodeUnknownSync(
      Schema.Struct({ advanceTime: Schema.Number, id: Schema.String }),
    )(JSON.parse(line));
    clock.advance(command.advanceTime);
    process.stdout.write(`${JSON.stringify({ advancedTime: command.id })}\n`);
  });
const runtime = ManagedRuntime.make(
  Layer.mergeAll(
    NodeServices.layer,
    Layer.effect(Scope.Scope, Effect.scope),
    clock ? Layer.succeed(Clock.Clock, clock) : Layer.empty,
  ),
);
let server: Runtime | undefined;
const listeningPort = () =>
  Number(new URL(server?.address ?? 'http://127.0.0.1:0').port);
const startServer = composeServer({
  githubReader: ghPullRequestReaderLayer,
  networkAddressReader: () =>
    new FixedNetworkAddressReader(
      [
        {
          interfaceName: 'lo',
          address: '127.0.0.1',
          family: 'IPv4',
          internal: true,
          physical: false,
          netmask: '255.0.0.0',
          cidr: '127.0.0.1/8',
        },
        {
          interfaceName: 'eth0',
          address: '192.168.1.20',
          family: 'IPv4',
          internal: false,
          physical: true,
          netmask: '255.255.255.0',
          cidr: '192.168.1.20/24',
        },
        {
          interfaceName: 'docker0',
          address: '172.17.0.1',
          family: 'IPv4',
          internal: false,
          physical: false,
          netmask: '255.255.0.0',
          cidr: '172.17.0.1/16',
        },
        {
          interfaceName: 'tun0',
          address: '10.8.0.51',
          family: 'IPv4',
          internal: false,
          physical: false,
          netmask: '255.255.255.0',
          cidr: '10.8.0.51/24',
        },
      ],
      [
        {
          interfaceName: 'eth0',
          metric: 100,
          gateway: '192.168.1.1',
          gatewayHardware: '02:00:5e:10:00:01',
        },
      ],
    ).layer,
  routeListenerRunner: () =>
    InMemoryRouteListenerRunner.layer(
      new InMemoryRouteListenerRunner(listeningPort, () => 41000),
    ),
  tunnelProbe: () =>
    new ScriptedTunnelProbe(
      Effect.fn(function* ({ origin }) {
        const { hostname } = new URL(origin);
        if (hostname.split('.').includes('invalid'))
          return { kind: 'unreachable' };
        if (hostname.endsWith('.test')) return { kind: 'foreign' };
        const health = yield* Effect.promise(() =>
          fetch(`${server?.address ?? ''}/api/health`),
        );
        return {
          kind: 'answered',
          environmentId: Schema.decodeUnknownSync(healthSchema)(
            yield* Effect.promise(() => health.json()),
          ).environmentId,
        };
      }),
    ).layer,
});
const relay = createServer((incoming) => {
  const address = new URL(server?.address ?? 'http://127.0.0.1:0');
  const outgoing = connect(Number(address.port), address.hostname);
  incoming.pipe(outgoing).pipe(incoming);
  incoming.on('error', () => outgoing.destroy());
  outgoing.on('error', () => incoming.destroy());
});
const listedMethods = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);
const routes = new Set<string>();
const hitsFile = join(root, 'hits.jsonl');
let closePortConflict: (() => Promise<void>) | undefined;
let fixtureReady = false;
subscribe('porcelain.http', (message) => {
  if (
    typeof message !== 'object' ||
    message === null ||
    !('event' in message) ||
    !('owner' in message)
  )
    return;
  const owner = message.owner === true;
  if (
    message.event === 'registered' &&
    'method' in message &&
    'route' in message &&
    typeof message.route === 'string'
  ) {
    const methods =
      message.method === '*' ? [...listedMethods] : [message.method];
    for (const method of methods)
      if (typeof method === 'string' && listedMethods.has(method))
        routes.add(`${owner ? 'owner ' : ''}${method} ${message.route}`);
  } else if (
    fixtureReady &&
    'id' in message &&
    typeof message.id === 'string'
  ) {
    appendFileSync(
      hitsFile,
      `${JSON.stringify({ ...message, id: owner ? `owner-${message.id}` : message.id })}\n`,
    );
  }
});
function registeredRoutes() {
  return [...routes].sort();
}
const sample = process.env.PORCELAIN_DEV_SAMPLE;
const COMMITTED = '# Sample repository\n';
const fixture = {
  folders: {
    home: 'home',
    repository: 'repository',
    state: 'state',
    web: 'web',
  },
  branch: 'main',
  device: { label: 'Development setup', platform: 'Development' },
  readme: {
    path: 'README.md',
    committed: COMMITTED,
    changed: `${COMMITTED}\nA change to review.\n`,
  },
  initialCommit: 'Initial commit',
  web: {
    shell: '<!doctype html><title>Porcelain</title>\n',
    asset: { path: 'assets/app-0123abcd.js', text: 'export {};\n' },
    escape: 'leak.txt',
  },
  summaryLinkLifetimeMs: 2000,
  liveTicketLifetimeMs: 1000,
  inventoryStaleAfterMs: 200,
  codingTool,
  serviceUpdate: {
    version: sample === 'service-ahead' ? '2.0.0' : '1.0.0',
    latest: '1.1.0',
    failure:
      'Could not install the persistent runtime: npm could not reach the registry',
    stepMs: 400,
  },
};
const offered = {
  managed: true,
  version: fixture.serviceUpdate.version,
  latest: fixture.serviceUpdate.latest,
  available: sample !== 'service-ahead',
  running: false,
  last: undefined,
};
const attempt = (stage: 'downloading' | 'installing' | 'restarting') => ({
  ...offered,
  running: true,
  last: {
    from: fixture.serviceUpdate.version,
    target: fixture.serviceUpdate.latest,
    stage,
    reason: undefined,
  },
});
const serviceUpdateRunner = new ScriptedServiceUpdateRunner(
  offered,
  [
    [
      attempt('downloading'),
      attempt('installing'),
      {
        ...offered,
        last: {
          from: fixture.serviceUpdate.version,
          target: fixture.serviceUpdate.latest,
          stage: 'failed',
          reason: fixture.serviceUpdate.failure,
        },
      },
    ],
    [
      attempt('downloading'),
      attempt('installing'),
      attempt('restarting'),
      {
        ...offered,
        version: fixture.serviceUpdate.latest,
        available: false,
        last: {
          from: fixture.serviceUpdate.version,
          target: fixture.serviceUpdate.latest,
          stage: 'updated',
          reason: undefined,
        },
      },
    ],
  ],
  fixture.serviceUpdate.stepMs,
  () => {
    const path = join(
      root,
      fixture.folders.state,
      'service-update-fixture.json',
    );
    if (!existsSync(path)) return undefined;
    const value = Schema.decodeUnknownSync(
      Schema.Union([readServiceUpdateResponseSchema, Schema.Literal('error')]),
    )(JSON.parse(readFileSync(path, 'utf8')));
    if (value === 'error')
      throw new Error('Service update fixture read failed');
    return value;
  },
);

try {
  const home = join(root, fixture.folders.home);
  const repository = join(root, fixture.folders.repository);
  const state = join(root, fixture.folders.state);
  await mkdir(home);
  Object.assign(process.env, {
    HOME: home,
    XDG_CONFIG_HOME: home,
    XDG_CACHE_HOME: join(root, 'cache'),
    XDG_DATA_HOME: join(root, 'data'),
    TMPDIR: root,
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_TERMINAL_PROMPT: '0',
    GIT_CONFIG_COUNT: '1',
    GIT_CONFIG_KEY_0: 'core.hooksPath',
    GIT_CONFIG_VALUE_0: '/dev/null',
    GCM_INTERACTIVE: 'Never',
  });
  const git = async (...args: string[]) => {
    await execute('git', args, { cwd: repository, env: process.env });
  };
  await mkdir(repository);
  await git('init', '-b', fixture.branch);
  await git('config', 'user.name', 'Porcelain Development');
  await git('config', 'user.email', 'porcelain@example.invalid');
  const readme = join(repository, fixture.readme.path);
  await writeFile(readme, fixture.readme.committed);
  await git('add', fixture.readme.path);
  await git('commit', '-m', fixture.initialCommit);
  if (sample === 'walkthrough') await prepareWalkthroughSample(repository);
  await writeFile(readme, fixture.readme.changed);
  const web = join(root, fixture.folders.web);
  await mkdir(join(web, 'assets'), { recursive: true });
  await writeFile(join(web, 'index.html'), fixture.web.shell);
  await writeFile(join(web, fixture.web.asset.path), fixture.web.asset.text);
  await symlink('../credential.json', join(web, fixture.web.escape));
  const desktopCredential = randomBytes(32).toString('base64url');
  if (sample === 'startup-bind-conflict') {
    const conflict = createServer();
    await new Promise<void>((resolve, reject) => {
      conflict.once('error', reject);
      conflict.listen(port, '127.0.0.1', resolve);
    });
    closePortConflict = () =>
      new Promise<void>((resolve, reject) =>
        conflict.close((error) => (error ? reject(error) : resolve())),
      );
  }
  const settings = readServerSettings({
    dataDirectory: state,
    projectHome: root,
    port,
    allowedHosts: Schema.decodeUnknownSync(Schema.Array(listenHostSchema))(
      JSON.parse(process.env.PORCELAIN_DEV_ALLOWED_HOSTS ?? '[]'),
    ),
    webRoot: web,
  });
  const gitActions =
    sample === 'git-interruption'
      ? { ...settings.limits.gitActions, deadlineMs: 1500 }
      : settings.limits.gitActions;
  server = await runtime.runPromise(
    startServer(
      {
        ...settings,
        limits: {
          ...settings.limits,
          jobs: {
            ...settings.limits.jobs,
            scanInventory: Duration.millis(250),
          },
          access: {
            ...settings.limits.access,
            liveTicket: {
              ...settings.limits.access.liveTicket,
              lifetimeMs: fixture.liveTicketLifetimeMs,
            },
          },
          inventory: {
            ...settings.limits.inventory,
            staleAfterMs: fixture.inventoryStaleAfterMs,
          },
          gitActions,
          reviews: {
            ...settings.limits.reviews,
            summaryLink: {
              ...settings.limits.reviews.summaryLink,
              lifetimeMs: fixture.summaryLinkLifetimeMs,
            },
          },
        },
      },
      {
        serviceUpdateRunner,
        version: fixture.serviceUpdate.version,
        desktopSession: {
          deviceId: randomUUID(),
          secretHash: createHash('sha256')
            .update(desktopCredential)
            .digest('hex'),
        },
      },
    ),
    { signal: shutdown.signal },
  );
  const serverAddress = server.address;
  const [grant] = Schema.decodeUnknownSync(issuedPairingSchema)(
    await Effect.runPromise(
      Effect.gen(function* () {
        const client = yield* ownerClient(
          state,
          settings.limits.owner.requestTimeoutMs,
        );
        return yield* ownerRequest(
          client.administration.issuePairing({
            payload: {
              labels: [fixture.device.label],
              addresses: [new URL(serverAddress).origin],
              trusted: false,
            },
          }),
        );
      }),
    ),
  ).grants;
  if (!grant) throw new Error('Could not create a development pairing');
  const paired = await fetch(`${server.address}/api/pair`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      code: grant.code,
      platform: fixture.device.platform,
    }),
    signal: shutdown.signal,
  });
  if (!paired.ok)
    throw new Error(`Development pairing failed: ${paired.status}`);
  const pairing = Schema.decodeUnknownSync(redeemedPairingSchema)(
    await paired.json(),
  );
  const credential = pairing.credential;
  if (credential === undefined || credential === '')
    throw new Error('Development pairing returned no credential');
  const registered = await fetch(`${server.address}/api/projects`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${credential}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ path: repository }),
    signal: shutdown.signal,
  });
  if (!registered.ok)
    throw new Error(
      `Sample repository registration failed: ${registered.status}`,
    );
  if (sample === 'walkthrough') {
    const inventory = await fetch(`${server.address}/api/inventory`, {
      headers: { authorization: `Bearer ${credential}` },
      signal: shutdown.signal,
    });
    const projects = Schema.decodeUnknownSync(readInventoryResponseSchema)(
      await inventory.json(),
    ).projects;
    const project = projects.find((entry) =>
      entry.worktrees.some((worktree) => worktree.path === repository),
    );
    const worktree = project?.worktrees.find(
      (entry) => entry.path === repository,
    );
    if (!project || !worktree)
      throw new Error('The walkthrough sample must be registered');
    await seedWalkthroughSample(state, repository, {
      projectId: project.id,
      worktreeId: worktree.id,
    });
  }
  await new Promise<void>((resolveRelay, rejectRelay) => {
    relay.once('error', rejectRelay);
    relay.listen(join(root, 'network.sock'), () => resolveRelay());
  });
  const credentialFile = join(root, 'credential.json');
  await writeFile(
    credentialFile,
    `${JSON.stringify({ credential, desktopCredential })}\n`,
    { mode: 0o600 },
  );
  const manifest = join(root, 'manifest.json');
  fixtureReady = true;
  await writeFile(
    manifest,
    `${JSON.stringify({ address: server.address, dataDirectory: state, repository, socketPath: server.socketPath, credentialFile, hitsFile, bin, installation, codingTool: codingToolExecutable, fixture: { ...fixture, gitActionDeadlineMs: gitActions.deadlineMs }, routes: registeredRoutes() }, null, 2)}\n`,
    { mode: 0o600 },
  );
  process.stdout.write(
    `${JSON.stringify({ manifest, address: server.address, repository })}\n`,
  );
  if (!shutdown.signal.aborted)
    await new Promise<void>((resolve) =>
      shutdown.signal.addEventListener('abort', () => resolve(), {
        once: true,
      }),
    );
} catch (error) {
  if (!shutdown.signal.aborted) {
    if (process.platform === 'linux' && inspect(error).includes('EADDRINUSE')) {
      try {
        const [tcp, tcp6, namespace, entries] = await Promise.all([
          readFile('/proc/net/tcp', 'utf8'),
          readFile('/proc/net/tcp6', 'utf8'),
          readlink('/proc/self/ns/net'),
          readdir('/proc'),
        ]);
        const owners = (
          await Promise.all(
            entries
              .filter((entry) => /^\d+$/.test(entry))
              .map(async (pid) => {
                const descriptors = await readdir(`/proc/${pid}/fd`).catch(
                  () => [],
                );
                const sockets = (
                  await Promise.all(
                    descriptors.map((fd) =>
                      readlink(`/proc/${pid}/fd/${fd}`).catch(() => ''),
                    ),
                  )
                ).filter((target) => target.startsWith('socket:['));
                return { pid: Number(pid), sockets };
              }),
          )
        ).filter((owner) => owner.sockets.length > 0);
        process.stderr.write(
          `${JSON.stringify({ kind: 'startup-bind-snapshot', pid: process.pid, port, namespace, tcp, tcp6, owners })}\n`,
        );
      } catch (snapshotError) {
        process.stderr.write(
          `${JSON.stringify({ kind: 'startup-bind-snapshot-unavailable', reason: String(snapshotError) })}\n`,
        );
      }
    }
    process.stderr.write(`${inspect(error)}\n`);
    process.exitCode = 1;
  }
} finally {
  try {
    relay.close();
    if (server !== undefined) await runtime.runPromise(server.close());
    await closePortConflict?.();
  } finally {
    try {
      await runtime.dispose();
    } finally {
      control?.close();
      process.stdin.destroy();
      process.off('SIGINT', stop);
      process.off('SIGTERM', stop);
    }
  }
}
