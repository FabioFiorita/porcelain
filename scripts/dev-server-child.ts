import { execFile } from 'node:child_process';
import { subscribe } from 'node:diagnostics_channel';
import { mkdir, symlink, writeFile } from 'node:fs/promises';
import { request } from 'node:http';
import { connect, createServer } from 'node:net';
import { join } from 'node:path';
import { promisify } from 'node:util';
import {
  issuePairingResponseSchema,
  redeemPairingResponseSchema,
} from '@porcelain/contracts/access';
import {
  startRuntime,
  type Runtime,
} from '../apps/server/src/bootstrap/runtime.ts';
import { readServerSettings } from '../apps/server/src/config/server-settings.ts';

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
let server: Runtime | undefined;
const relay = createServer((incoming) => {
  const address = new URL(server?.address ?? 'http://127.0.0.1:0');
  const outgoing = connect(Number(address.port), address.hostname);
  incoming.pipe(outgoing).pipe(incoming);
  incoming.on('error', () => outgoing.destroy());
  outgoing.on('error', () => incoming.destroy());
});

type RouteOptions = { method: string | readonly string[]; url: string };
type RouteHost = {
  addHook(name: 'onRoute', hook: (route: RouteOptions) => void): unknown;
  server: { address(): unknown };
};

function isRouteHost(value: unknown): value is RouteHost {
  return (
    typeof value === 'object' &&
    value !== null &&
    'addHook' in value &&
    typeof value.addHook === 'function' &&
    'server' in value
  );
}

const listedMethods = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);
const listeners: { host: RouteHost; routes: string[] }[] = [];
subscribe('fastify.initialization', (message) => {
  const host =
    typeof message === 'object' && message !== null && 'fastify' in message
      ? message.fastify
      : undefined;
  if (!isRouteHost(host)) return;
  const listener = { host, routes: new Array<string>() };
  listeners.push(listener);
  host.addHook('onRoute', (route) => {
    const methods =
      typeof route.method === 'string' ? [route.method] : route.method;
    for (const method of methods)
      if (listedMethods.has(method))
        listener.routes.push(`${method} ${route.url}`);
  });
});

function registeredRoutes() {
  return listeners.flatMap(({ host, routes }) => {
    const prefix = typeof host.server.address() === 'string' ? 'owner ' : '';
    return [...new Set(routes)].sort().map((route) => `${prefix}${route}`);
  });
}

function askOwner(socketPath: string, path: string, body: unknown) {
  const payload = JSON.stringify(body);
  return new Promise<unknown>((resolveAnswer, rejectAnswer) => {
    const outgoing = request(
      {
        socketPath,
        path,
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'content-length': String(Buffer.byteLength(payload)),
        },
        signal: shutdown.signal,
      },
      (incoming) => {
        const chunks: Buffer[] = [];
        incoming.on('data', (chunk: Buffer) => chunks.push(chunk));
        incoming.on('error', rejectAnswer);
        incoming.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8');
          if (incoming.statusCode !== 200)
            rejectAnswer(
              new Error(
                `Owner ${path} answered ${incoming.statusCode}: ${raw}`,
              ),
            );
          else resolveAnswer(JSON.parse(raw));
        });
      },
    );
    outgoing.on('error', rejectAnswer);
    outgoing.end(payload);
  });
}

const committed = '# Sample repository\n';
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
    committed,
    changed: `${committed}\nA change to review.\n`,
  },
  initialCommit: 'Initial commit',
  web: {
    shell: '<!doctype html><title>Porcelain</title>\n',
    asset: { path: 'assets/app-0123abcd.js', text: 'export {};\n' },
    escape: 'leak.txt',
  },
  summaryLinkLifetimeMs: 2000,
};

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
  await writeFile(readme, fixture.readme.changed);

  const web = join(root, fixture.folders.web);
  await mkdir(join(web, 'assets'), { recursive: true });
  await writeFile(join(web, 'index.html'), fixture.web.shell);
  await writeFile(join(web, fixture.web.asset.path), fixture.web.asset.text);
  await symlink('../credential.json', join(web, fixture.web.escape));

  const settings = readServerSettings({
    dataDirectory: state,
    projectHome: root,
    port,
    webRoot: web,
  });
  server = await startRuntime(
    {
      ...settings,
      limits: {
        ...settings.limits,
        jobs: { ...settings.limits.jobs, refreshInventoryMs: 250 },
        reviews: {
          ...settings.limits.reviews,
          summaryLink: {
            ...settings.limits.reviews.summaryLink,
            lifetimeMs: fixture.summaryLinkLifetimeMs,
          },
        },
      },
    },
    shutdown.signal,
  );
  const issued = issuePairingResponseSchema.parse(
    await askOwner(server.socketPath, '/pairings', {
      labels: [fixture.device.label],
      addresses: [new URL(server.address).origin],
    }),
  );
  const [grant] = issued.grants;
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
  const pairing = redeemPairingResponseSchema.parse(await paired.json());
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

  await new Promise<void>((resolveRelay, rejectRelay) => {
    relay.once('error', rejectRelay);
    relay.listen(join(root, 'network.sock'), () => resolveRelay());
  });

  const credentialFile = join(root, 'credential.json');
  await writeFile(credentialFile, `${JSON.stringify({ credential })}\n`, {
    mode: 0o600,
  });
  const manifest = join(root, 'manifest.json');
  await writeFile(
    manifest,
    `${JSON.stringify({ address: server.address, dataDirectory: state, repository, socketPath: server.socketPath, credentialFile, fixture, routes: registeredRoutes() }, null, 2)}\n`,
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
    process.stderr.write(
      `${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`,
    );
    process.exitCode = 1;
  }
} finally {
  try {
    relay.close();
    await server?.close();
  } finally {
    process.stdin.destroy();
    process.off('SIGINT', stop);
    process.off('SIGTERM', stop);
  }
}
