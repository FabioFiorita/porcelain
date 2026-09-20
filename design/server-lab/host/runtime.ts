// Runs the real Porcelain server in this process, traced, and reports to the
// supervisor over IPC. One runtime per mode: switching mode restarts it.
import { AsyncResource } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import { subscribe, unsubscribe } from 'node:diagnostics_channel';
import { mkdir, mkdtemp, rename, rm } from 'node:fs/promises';
import {
  createServer as createHttpServer,
  type IncomingMessage,
  type ServerResponse,
} from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { performance } from 'node:perf_hooks';
import type {
  FastifyInstance,
  RouteOptions,
} from '../../../apps/server/node_modules/fastify/fastify.js';
import { z } from '../../../apps/server/node_modules/zod/index.js';
import type { CommitGenerator } from '../../../apps/server/src/agents/interfaces/commit-generator.ts';
import type { Application } from '../../../apps/server/src/application.ts';
import { NodeFileWriter } from '../../../apps/server/src/filesystem/file-writer.ts';
import type { FileWriter } from '../../../apps/server/src/filesystem/interfaces/file-writer.ts';
import { createOwnerServer } from '../../../apps/server/src/http/owner-server.ts';
import { createServer } from '../../../apps/server/src/http/server.ts';
import {
  ownerSocketPath,
  restrictOwnerSocket,
} from '../../../apps/server/src/lifecycle/owner-socket.ts';
import { ActionGit } from '../../../packages/git/src/action-git.ts';
import type { GitActionWriterFactory } from '../../../packages/git/src/interfaces/git-action-writer.ts';
import type {
  Origin,
  RouteInfo,
  RuntimeMessage,
  WorktreeInfo,
} from './protocol.ts';
import { readOnlyBlock } from './read-only.ts';
import { createTracer } from './tracing.ts';

const bootStarted = performance.now();
const send = (message: RuntimeMessage) => process.send?.(message);
const log = (line: string) => send({ type: 'log', line });
const mode = process.env.LAB_MODE === 'real' ? 'real' : 'playground';
const playgroundsDirectory = process.env.LAB_PLAYGROUNDS_DIRECTORY ?? '';
if (!playgroundsDirectory)
  throw new Error('The runtime is started by the lab supervisor.');

let cleanup: (() => Promise<void>) | undefined;
const shutdown = async () => {
  try {
    await cleanup?.();
  } finally {
    process.exit(0);
  }
};
process.on('message', (message: { type?: string }) => {
  if (message?.type === 'shutdown') void shutdown();
});
process.on('disconnect', () => void shutdown());

try {
  await start();
} catch (error) {
  send({
    type: 'failed',
    error:
      error instanceof Error ? (error.stack ?? error.message) : String(error),
  });
  await cleanup?.().catch(() => {});
  process.exit(1);
}

async function start() {
  // Assigned once the server is listening: a device is paired against a real
  // address, so there is nothing to invent before one exists.
  let credential = '';
  let dataDirectory: string;
  let worktrees: WorktreeInfo[] = [];
  let roots: [string, string][] = [];
  let playgroundRoot: string | undefined;
  let register: string[] = [];
  let seed: ((address: string) => Promise<void>) | undefined;
  const overrides: {
    commitGenerator: CommitGenerator;
    fileWriter?: FileWriter;
    actionGit?: GitActionWriterFactory;
    projectHome?: string;
  } = { commitGenerator: fixtureCommitGenerator() };

  if (mode === 'playground') {
    const profile = process.env.LAB_PROFILE || 'fixture';
    log(`Preparing the ${profile} playground (cached profiles start faster)…`);
    const { createPlayground } = await import(
      '../../../apps/server/src/development/create-playground.ts'
    );
    const created = performance.now();
    const fixture = await (
      createPlayground as (
        parent?: string,
        options?: { profile?: string; cacheDirectory?: string },
      ) => ReturnType<typeof createPlayground>
    )(playgroundsDirectory, {
      profile,
      cacheDirectory: join(playgroundsDirectory, '.cache'),
    });
    log(
      `Playground ready in ${((performance.now() - created) / 1000).toFixed(1)} s.`,
    );
    playgroundRoot = fixture.root;
    cleanup = () => rm(fixture.root, { recursive: true, force: true });
    // Same isolation as `pnpm dev`: no inherited Git or SSH configuration.
    for (const key of Object.keys(process.env))
      if (/^(GIT_|SSH_)/.test(key)) delete process.env[key];
    Object.assign(process.env, fixture.environment);
    dataDirectory = fixture.dataDirectory;
    const listed = (
      fixture as unknown as {
        worktrees?: {
          path: string;
          branch: string;
          role: WorktreeInfo['role'];
        }[];
      }
    ).worktrees;
    worktrees = listed ?? [
      { path: fixture.project, branch: 'main', role: 'main' },
      { path: fixture.worktree, branch: 'review', role: 'review' },
    ];
    let agents = 0;
    roots = [
      [fixture.root, '<playground>'],
      ...worktrees.map((worktree): [string, string] => [
        worktree.path,
        worktree.role === 'agent'
          ? `<agent-${++agents}>`
          : `<${worktree.role}>`,
      ]),
    ];
    register = [fixture.project];
    overrides.fileWriter = new NodeFileWriter(async (paths) => {
      const directory = join(fixture.root, 'trash');
      await mkdir(directory, { recursive: true });
      for (const path of paths)
        await rename(
          path,
          join(directory, `${randomUUID()}-${basename(path)}`),
        );
    });
    const { seedPlaygroundReview } = await import(
      '../../../apps/server/src/development/helpers/seed-playground-review.ts'
    );
    seed = async (address) => {
      const inventory = (await (
        await fetch(`${address}/api/inventory`, {
          headers: labHeaders(credential, 'setup'),
        })
      ).json()) as {
        projects: { id: string; worktrees: { id: string; main: boolean }[] }[];
      };
      const project = inventory.projects[0];
      const review = project?.worktrees.find((worktree) => !worktree.main);
      if (!project || !review) throw new Error('Playground worktrees missing');
      await seedPlaygroundReview(
        address,
        credential,
        project.id,
        review.id,
        fixture.reviewCommitOid,
        AbortSignal.timeout(60_000),
      );
    };
  } else {
    const repositories = JSON.parse(
      process.env.LAB_REAL_REPOSITORIES ?? '[]',
    ) as string[];
    if (repositories.length === 0) throw new Error('No repositories selected');
    // Private, disposable review state; the repositories themselves are only read.
    dataDirectory = await mkdtemp(join(tmpdir(), 'porcelain-lab-real-'));
    cleanup = () => rm(dataDirectory, { recursive: true, force: true });
    register = repositories;
    worktrees = repositories.map((path) => ({
      path,
      branch: '',
      role: 'real',
    }));
    roots = repositories.map((path): [string, string] => [
      path,
      `<${basename(path)}>`,
    ]);
    overrides.commitGenerator = {
      async models() {
        return [];
      },
      async generate() {
        throw new Error(
          'Commit drafting is disabled for real projects in the lab.',
        );
      },
    };
    overrides.fileWriter = {
      async edit() {
        throw new Error(
          'File edits are disabled for real projects in the lab.',
        );
      },
    };
    overrides.actionGit = (checkout, identity, repositoryIdentity) => {
      const git = new ActionGit(checkout, identity, repositoryIdentity);
      return {
        inspect: (intent, signal) => git.inspect(intent, signal),
        async execute() {
          throw new Error(
            'Git actions are disabled for real projects in the lab.',
          );
        },
      };
    };
  }

  const tracer = createTracer((trace) => send({ type: 'trace', trace }));
  tracer.setRoots(roots);
  tracer.onVitals((vitals) => send({ type: 'vitals', vitals }));

  const routes: RouteInfo[] = [];
  // Routes register before createServer returns, so catch the instance as
  // Fastify creates it.
  const catalog = (message: unknown) => {
    const { fastify } = message as { fastify: FastifyInstance };
    fastify.addHook('onRoute', collect);
  };
  subscribe('fastify.initialization', catalog);
  // The lab is a real installation in every way that matters, so it pairs a
  // device for itself against the address it ends up listening on.
  const reach = {
    port: 0,
    policy: { allowedHosts: [] as string[], localAddresses: [] as string[] },
  };
  const server = await createServer({
    dataDirectory,
    pairingReach: () => reach,
    ...overrides,
  }).finally(() => unsubscribe('fastify.initialization', catalog));
  const resource = Symbol('lab-async-resource');
  function collect(route: RouteOptions & { prefix?: string }) {
    const methods = Array.isArray(route.method) ? route.method : [route.method];
    for (const method of methods) {
      if (method === 'HEAD') continue;
      const schema = (route.schema ?? {}) as Record<string, unknown>;
      routes.push({
        method,
        url: route.url,
        params: toJsonSchema(schema.params),
        querystring: toJsonSchema(schema.querystring),
        body: toJsonSchema(schema.body),
        response: toJsonSchema(
          (schema.response as Record<string, unknown> | undefined)?.[200],
        ),
      });
    }
  }
  server.addHook('onRequest', (request, _reply, done) => {
    const trace = tracer.current();
    if (trace) trace.route = request.routeOptions.url;
    (request as unknown as Record<symbol, AsyncResource>)[resource] =
      new AsyncResource('lab-request');
    done();
  });
  // Body parsing runs in socket callbacks; re-enter the request's context.
  server.addHook('preValidation', (request, _reply, done) => {
    const scope = (
      request as unknown as Record<symbol, AsyncResource | undefined>
    )[resource];
    if (scope) scope.runInAsyncScope(done);
    else done();
  });
  await server.ready();

  const readOnly = mode === 'real';
  let booting = true;
  const http = createHttpServer((request, response) =>
    handle(request, response),
  );
  function handle(request: IncomingMessage, response: ServerResponse) {
    const method = request.method ?? 'GET';
    const url = request.url ?? '/';
    const header = (name: string) => {
      const value = request.headers[name];
      return Array.isArray(value) ? value[0] : value;
    };
    const origin =
      (header('x-lab-origin') as Origin | undefined) ??
      (booting ? 'setup' : 'console');
    tracer.request(
      {
        method,
        url,
        origin,
        run: header('x-lab-run'),
        step: header('x-lab-step'),
      },
      (trace, done) => {
        let bytes = 0;
        const write = response.write.bind(response);
        const end = response.end.bind(response);
        const count = (chunk: unknown) => {
          if (typeof chunk === 'string') bytes += Buffer.byteLength(chunk);
          else if (chunk instanceof Uint8Array) bytes += chunk.length;
        };
        response.write = ((chunk: unknown, ...rest: unknown[]) => {
          count(chunk);
          return (write as (...args: unknown[]) => boolean)(chunk, ...rest);
        }) as typeof response.write;
        response.end = ((chunk?: unknown, ...rest: unknown[]) => {
          if (typeof chunk !== 'function') count(chunk);
          return (end as (...args: unknown[]) => ServerResponse)(
            chunk,
            ...rest,
          );
        }) as typeof response.end;
        response.once('finish', () => done(response.statusCode, false, bytes));
        response.once('close', () => {
          if (!response.writableFinished)
            done(response.statusCode, true, bytes);
        });
        const blocked = readOnly ? readOnlyBlock(method, url) : undefined;
        if (blocked) {
          trace.blocked = blocked;
          response.writeHead(403, { 'content-type': 'application/json' });
          response.end(
            JSON.stringify({
              error: 'READ_ONLY',
              message: `Blocked by the server lab: ${blocked}`,
            }),
          );
          return;
        }
        server.routing(request, response);
      },
    );
  }
  await new Promise<void>((resolve) => http.listen(0, '127.0.0.1', resolve));
  const address = `http://127.0.0.1:${(http.address() as AddressInfo).port}`;
  reach.port = Number(new URL(address).port);
  reach.policy = { allowedHosts: [], localAddresses: ['127.0.0.1'] };
  // The agent door: an owner socket beside the network listener, exactly as a
  // real installation has. The console's MCP page speaks to this.
  const socketPath = ownerSocketPath(dataDirectory);
  const owner = createOwnerServer({
    application: server.application,
    status: () => ({ address, dataDirectory, pid: process.pid }),
  });
  await owner.listen({ path: socketPath });
  restrictOwnerSocket(socketPath);
  credential = await pairLabDevice(server.application, address);
  const previousCleanup = cleanup;
  cleanup = async () => {
    tracer.close();
    await new Promise<void>((resolve) => http.close(() => resolve()));
    http.closeAllConnections();
    await owner.close();
    await server.close();
    await previousCleanup?.();
  };

  for (const path of register) {
    const response = await fetch(`${address}/api/projects`, {
      method: 'POST',
      headers: {
        ...labHeaders(credential, 'setup'),
        'content-type': 'application/json',
      },
      body: JSON.stringify({ path }),
    });
    if (!response.ok)
      throw new Error(
        `Could not register ${mode === 'real' ? basename(path) : 'the playground'}: ${response.status} ${await response.text()}`,
      );
  }
  await seed?.(address);
  if (mode === 'real') {
    // Every linked worktree registers with its repository; label each one.
    const inventory = (await (
      await fetch(`${address}/api/inventory`, {
        headers: labHeaders(credential, 'setup'),
      })
    ).json()) as {
      projects: {
        name: string;
        worktrees: { path: string; branch: string | null; main: boolean }[];
      }[];
    };
    worktrees = inventory.projects.flatMap((project) =>
      project.worktrees.map((worktree) => ({
        path: worktree.path,
        branch: worktree.branch ?? '',
        role: 'real' as const,
      })),
    );
    tracer.setRoots(
      inventory.projects.flatMap((project) =>
        project.worktrees.map((worktree): [string, string] => [
          worktree.path,
          worktree.main
            ? `<${project.name}>`
            : `<${project.name}:${basename(worktree.path)}>`,
        ]),
      ),
    );
  }
  booting = false;
  tracer.setBackgroundLabel('unattributed');
  send({
    type: 'ready',
    address,
    credential,
    socketPath,
    readOnly,
    ...(playgroundRoot ? { playgroundRoot } : {}),
    worktrees,
    routes: routes.sort(
      (a, b) => a.url.localeCompare(b.url) || a.method.localeCompare(b.method),
    ),
    readyMs: Math.round(performance.now() - bootStarted),
  });
  log(`Server listening on ${address}`);
}

function labHeaders(credential: string, origin: Origin) {
  return { authorization: `Bearer ${credential}`, 'x-lab-origin': origin };
}

/**
 * One ephemeral device for this lab run, redeemed through the real pairing
 * route. It lives and dies with the lab's own state directory.
 */
async function pairLabDevice(application: Application, address: string) {
  const [issued] = await application.issuePairing(
    ['Server lab'],
    [new URL(address).origin],
  );
  if (!issued) throw new Error('The lab could not issue a pairing link');
  const redeemed = await fetch(`${address}/api/pair`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ code: issued.code, platform: 'Server lab' }),
  });
  if (!redeemed.ok) throw new Error('The lab could not pair its own device');
  const { credential } = (await redeemed.json()) as { credential?: string };
  if (!credential) throw new Error('Pairing returned no credential');
  return credential;
}

function toJsonSchema(schema: unknown) {
  if (!schema || typeof schema !== 'object') return undefined;
  try {
    return z.toJSONSchema(schema as z.ZodType, {
      unrepresentable: 'any',
      io: 'input',
    });
  } catch {
    return undefined;
  }
}

function fixtureCommitGenerator(): CommitGenerator {
  return {
    async models() {
      return [{ id: 'lab:fixture', label: 'Lab fixture model' }];
    },
    async generate(_model, prompt) {
      const paths = JSON.parse(
        prompt.split('Selected paths: ')[1]?.split('\n')[0] ?? '[]',
      ) as string[];
      return prompt.startsWith('Write exactly')
        ? [{ message: 'Review workspace changes', paths }]
        : paths.map((path) => ({ message: `Update ${path}`, paths: [path] }));
    },
  };
}
