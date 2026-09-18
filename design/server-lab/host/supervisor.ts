// Server lab: `npm run lab` in design/server-lab.
// Owns the traced runtime (the real server, one mode at a time), the real web
// app pointed at it, the lab UI (Vite middleware) and the lab API.
import { type ChildProcess, fork, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import {
  createServer,
  request as httpRequest,
  type IncomingMessage,
  type ServerResponse,
} from 'node:http';
import { dirname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer as createViteServer } from 'vite';
import { benchSteps, runBench } from './bench.ts';
import type {
  BenchRun,
  Budget,
  LabEvent,
  RuntimeMessage,
  RuntimeMode,
  RuntimeState,
  Trace,
  Vitals,
  WebState,
} from './protocol.ts';
import { listRepositories, measureRepository, realRoots } from './repos.ts';
import {
  type SimulationAction,
  simulate,
  simulationActions,
  stopAllStreams,
} from './simulate.ts';

const labRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = resolve(labRoot, '../..');
const stateDirectory = join(labRoot, '.lab');
const tokenFile = join(stateDirectory, 'token');
const budgetsFile = join(labRoot, 'budgets.json');
const benchFile = join(stateDirectory, 'bench-history.json');
const playgroundsDirectory = join(repoRoot, '.playgrounds');
const port = Number(process.env.LAB_PORT ?? 5199);
const webPort = Number(process.env.LAB_WEB_PORT ?? 5198);
const MAX_TRACES = 5000;

await mkdir(stateDirectory, { recursive: true, mode: 0o700 });

// ---------------------------------------------------------------- events
const clients = new Set<ServerResponse>();
const broadcast = (event: LabEvent) => {
  const data = `data: ${JSON.stringify(event)}\n\n`;
  for (const client of clients) client.write(data);
};

// ---------------------------------------------------------------- traces
const traces = new Map<string, Trace>();
let vitals: Vitals | undefined;
const storeTrace = (trace: Trace) => {
  traces.delete(trace.id);
  traces.set(trace.id, trace);
  while (traces.size > MAX_TRACES) {
    const oldest = traces.keys().next().value;
    if (oldest === undefined) break;
    traces.delete(oldest);
  }
  broadcast({ type: 'trace', trace });
};

// ---------------------------------------------------------------- runtime
const runtime: {
  child?: ChildProcess;
  state: RuntimeState;
  token?: string;
  generation: number;
} = { state: { status: 'stopped' }, generation: 0 };

const setRuntime = (state: RuntimeState) => {
  runtime.state = state;
  broadcast({ type: 'runtime', state });
};
const appendLog = (line: string) => {
  const state = runtime.state;
  if (state.status === 'stopped') return;
  state.log.push(line);
  if (state.log.length > 300) state.log.splice(0, state.log.length - 300);
  broadcast({ type: 'runtime', state });
};

async function stopRuntime() {
  const child = runtime.child;
  runtime.child = undefined;
  runtime.token = undefined;
  runtime.generation++;
  stopAllStreams();
  if (child && child.exitCode === null && child.signalCode === null) {
    const exited = new Promise((done) => child.once('exit', done));
    child.send?.({ type: 'shutdown' });
    const timer = setTimeout(() => child.kill('SIGKILL'), 20_000);
    await exited;
    clearTimeout(timer);
  }
  setRuntime({ status: 'stopped' });
}

async function startRuntime(mode: RuntimeMode): Promise<RuntimeState> {
  const leavingReal =
    runtime.state.status !== 'stopped' && runtime.state.mode.kind === 'real';
  await stopRuntime();
  if (leavingReal) {
    // What was seen in a real project does not outlive observing it.
    traces.clear();
    broadcast({ type: 'cleared' });
  }
  const generation = runtime.generation;
  const since = Date.now();
  setRuntime({ status: 'starting', mode, since, log: [] });
  const child = fork(join(labRoot, 'host/runtime.ts'), [], {
    cwd: repoRoot,
    env: {
      ...process.env,
      LAB_MODE: mode.kind,
      LAB_PROFILE: mode.kind === 'playground' ? mode.profile : '',
      LAB_REAL_REPOSITORIES:
        mode.kind === 'real' ? JSON.stringify(mode.repositories) : '[]',
      LAB_TOKEN_FILE: tokenFile,
      LAB_PLAYGROUNDS_DIRECTORY: playgroundsDirectory,
    },
    stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
  });
  runtime.child = child;
  const current = () => generation === runtime.generation;
  for (const stream of [child.stdout, child.stderr])
    stream?.setEncoding('utf8').on('data', (chunk: string) => {
      if (!current()) return;
      for (const line of chunk.split('\n')) if (line.trim()) appendLog(line);
    });
  return new Promise((settle) => {
    child.on('message', async (message: RuntimeMessage) => {
      if (!current()) return;
      switch (message.type) {
        case 'log':
          appendLog(message.line);
          break;
        case 'trace':
          storeTrace(message.trace);
          break;
        case 'vitals':
          vitals = message.vitals;
          broadcast({ type: 'vitals', vitals: message.vitals });
          break;
        case 'failed':
          setRuntime({
            status: 'failed',
            mode,
            error: message.error,
            log: runtime.state.status === 'stopped' ? [] : runtime.state.log,
          });
          settle(runtime.state);
          break;
        case 'ready': {
          runtime.token = (await readFile(tokenFile, 'utf8')).trim();
          setRuntime({
            status: 'ready',
            mode,
            since,
            readyMs: Date.now() - since,
            address: message.address,
            readOnly: message.readOnly,
            ...(message.playgroundRoot
              ? { playgroundRoot: message.playgroundRoot }
              : {}),
            worktrees: message.worktrees,
            routes: message.routes,
            log: runtime.state.status === 'stopped' ? [] : runtime.state.log,
          });
          settle(runtime.state);
          break;
        }
      }
    });
    child.on('exit', (code) => {
      if (!current()) return;
      if (
        runtime.state.status === 'starting' ||
        runtime.state.status === 'ready'
      ) {
        setRuntime({
          status: 'failed',
          mode,
          error: `The runtime exited (code ${code}).`,
          log: runtime.state.log,
        });
        settle(runtime.state);
      }
    });
  });
}

// ---------------------------------------------------------------- real web
const web: { child?: ChildProcess; state: WebState } = {
  state: { status: 'stopped' },
};
const setWeb = (state: WebState) => {
  web.state = state;
  broadcast({ type: 'web', state });
};
function startWeb() {
  if (web.child) return;
  const url = `http://127.0.0.1:${webPort}`;
  setWeb({ status: 'starting', url });
  const child = spawn(
    process.execPath,
    [
      join(repoRoot, 'apps/web/node_modules/vite/bin/vite.js'),
      '--port',
      String(webPort),
      '--host',
      '127.0.0.1',
      '--strictPort',
    ],
    {
      cwd: join(repoRoot, 'apps/web'),
      env: {
        ...process.env,
        PORCELAIN_API_TARGET: `http://127.0.0.1:${port}/porcelain-web`,
        PORCELAIN_PLAYGROUND_TOKEN_FILE: tokenFile,
        PORCELAIN_PLAYGROUND_BRIDGE: '1',
        PORCELAIN_PLAYGROUND_AUTO_CONNECT: '1',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  web.child = child;
  let output = '';
  const watch = (chunk: string) => {
    output = (output + chunk).slice(-4000);
    if (web.state.status === 'starting' && /ready in|Local:/.test(output))
      setWeb({ status: 'ready', url });
  };
  child.stdout?.setEncoding('utf8').on('data', watch);
  child.stderr?.setEncoding('utf8').on('data', watch);
  child.on('exit', (code) => {
    web.child = undefined;
    setWeb(
      code === 0 || code === null
        ? { status: 'stopped' }
        : {
            status: 'failed',
            error: output.trim().split('\n').slice(-6).join('\n'),
          },
    );
  });
}
async function stopWeb() {
  const child = web.child;
  if (!child) return;
  const exited = new Promise((done) => child.once('exit', done));
  child.kill('SIGTERM');
  await exited;
}

// ---------------------------------------------------------------- bench
const benchHistory: BenchRun[] = await readFile(benchFile, 'utf8')
  .then((text) => JSON.parse(text) as BenchRun[])
  .catch(() => []);
let benchRunning = false;
const describe = (mode: RuntimeMode) =>
  mode.kind === 'playground'
    ? `playground:${mode.profile}`
    : `real:${mode.repositories.length} repo(s)`;

async function benchOnce(): Promise<BenchRun> {
  const state = runtime.state;
  if (state.status !== 'ready' || !runtime.token)
    throw new Error('The runtime is not ready.');
  const run: BenchRun = {
    id: randomUUID(),
    at: Date.now(),
    target: describe(state.mode),
    real: state.mode.kind === 'real',
    steps: [],
  };
  broadcast({ type: 'bench', run, progress: 'Starting', done: false });
  try {
    run.steps = await runBench(
      {
        address: state.address,
        token: runtime.token,
        run: run.id,
        real: run.real,
        worktrees: state.worktrees,
        ...(state.playgroundRoot
          ? {
              simulate: (
                worktree: string,
                action: SimulationAction,
                count: number,
              ) =>
                simulate(
                  state.playgroundRoot as string,
                  worktree,
                  action,
                  count,
                ),
            }
          : {}),
        progress: (progress) =>
          broadcast({ type: 'bench', run, progress, done: false }),
      },
      (id, step) =>
        [...traces.values()].filter(
          (trace) => trace.run === id && trace.step === step,
        ),
    );
  } catch (error) {
    run.error = error instanceof Error ? error.message : String(error);
  }
  benchHistory.unshift(run);
  benchHistory.splice(100);
  // Real-project numbers stay in memory.
  await writeFile(
    benchFile,
    JSON.stringify(
      benchHistory.filter((entry) => !entry.real),
      null,
      1,
    ),
  );
  broadcast({ type: 'bench', run, done: true });
  return run;
}

async function bench(targets: RuntimeMode[] | undefined) {
  if (benchRunning) throw new Error('A benchmark is already running.');
  benchRunning = true;
  try {
    if (!targets?.length) return [await benchOnce()];
    const runs: BenchRun[] = [];
    for (const target of targets) {
      const state = await startRuntime(target);
      if (state.status !== 'ready') {
        const failed: BenchRun = {
          id: randomUUID(),
          at: Date.now(),
          target: describe(target),
          real: target.kind === 'real',
          steps: [],
          error:
            state.status === 'failed' ? state.error : 'Runtime did not start',
        };
        benchHistory.unshift(failed);
        broadcast({ type: 'bench', run: failed, done: true });
        runs.push(failed);
        continue;
      }
      runs.push(await benchOnce());
    }
    return runs;
  } finally {
    benchRunning = false;
  }
}

// ---------------------------------------------------------------- helpers
async function profiles() {
  try {
    const module = (await import(
      join(repoRoot, 'apps/server/src/development/profiles.ts')
    )) as { playgroundProfiles?: Record<string, unknown> };
    if (module.playgroundProfiles) return module.playgroundProfiles;
  } catch {}
  return {
    fixture: { label: 'Fixture', description: 'The original 34-file sample.' },
  };
}

async function readBudgets(): Promise<Record<string, Budget>> {
  return readFile(budgetsFile, 'utf8')
    .then((text) => JSON.parse(text) as Record<string, Budget>)
    .catch(() => ({}));
}

const sourceRoots = [
  'apps/server/',
  'apps/web/src/',
  'packages/',
  'docs/',
  'scripts/',
  'AGENTS.md',
  'README.md',
];
async function readSource(path: string) {
  const clean = normalize(path).replace(/^(\.\.(\/|$))+/, '');
  if (!sourceRoots.some((root) => clean === root || clean.startsWith(root)))
    throw Object.assign(new Error('Outside the Porcelain source.'), {
      status: 403,
    });
  if (clean.includes('node_modules'))
    throw Object.assign(new Error('No.'), { status: 403 });
  return readFile(join(repoRoot, clean), 'utf8');
}

async function body(
  request: IncomingMessage,
): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(chunk as Buffer);
  const text = Buffer.concat(chunks).toString('utf8');
  return text ? (JSON.parse(text) as Record<string, unknown>) : {};
}

function json(response: ServerResponse, status: number, value: unknown) {
  response.writeHead(status, {
    'content-type': 'application/json',
    'cache-control': 'no-store',
  });
  response.end(JSON.stringify(value));
}

function proxy(
  request: IncomingMessage,
  response: ServerResponse,
  path: string,
  kind: 'console' | 'web',
) {
  const state = runtime.state;
  if (state.status !== 'ready' || !runtime.token) {
    json(response, 503, {
      error: 'LAB_RUNTIME_NOT_READY',
      message: 'The server is not running.',
    });
    return;
  }
  const target = new URL(state.address);
  const headers: Record<string, string | string[] | undefined> = {
    ...request.headers,
  };
  if (kind === 'console') {
    // The lab speaks for the reviewer with the bearer token, like the CLI would.
    headers.authorization = `Bearer ${runtime.token}`;
    headers.host = target.host;
    delete headers.origin;
    delete headers.referer;
    delete headers.cookie;
    headers['x-lab-origin'] ??= 'console';
  } else headers['x-lab-origin'] = 'web';
  const upstream = httpRequest(
    {
      hostname: target.hostname,
      port: target.port,
      method: request.method,
      path,
      headers,
    },
    (reply) => {
      response.writeHead(reply.statusCode ?? 502, reply.headers);
      reply.pipe(response);
    },
  );
  upstream.on('error', (error) => {
    if (!response.headersSent)
      json(response, 502, { error: 'LAB_PROXY', message: error.message });
    else response.destroy();
  });
  // A client that gives up (e.g. TanStack Query cancelling) aborts upstream too,
  // exactly as it would without the lab in between.
  response.on('close', () => {
    if (!response.writableFinished) upstream.destroy();
  });
  request.pipe(upstream);
}

// ---------------------------------------------------------------- http
const server = createServer();
const vite = await createViteServer({
  root: labRoot,
  configFile: join(labRoot, 'vite.config.ts'),
  server: { middlewareMode: true, hmr: { server } },
  appType: 'spa',
  logLevel: 'warn',
});

server.on('request', async (request, response) => {
  const url = new URL(request.url ?? '/', 'http://lab');
  const path = url.pathname;
  try {
    if (path.startsWith('/porcelain-web/') || path === '/porcelain-web') {
      proxy(
        request,
        response,
        (request.url ?? '/').slice('/porcelain-web'.length) || '/',
        'web',
      );
      return;
    }
    if (path.startsWith('/porcelain/') || path === '/porcelain') {
      proxy(
        request,
        response,
        (request.url ?? '/').slice('/porcelain'.length) || '/',
        'console',
      );
      return;
    }
    if (!path.startsWith('/lab/api/')) {
      vite.middlewares(request, response);
      return;
    }
    const route = `${request.method} ${path.slice('/lab/api'.length)}`;
    switch (route) {
      case 'GET /events': {
        response.writeHead(200, {
          'content-type': 'text/event-stream',
          'cache-control': 'no-store',
          connection: 'keep-alive',
        });
        response.write(
          `data: ${JSON.stringify({ type: 'runtime', state: runtime.state })}\n\n`,
        );
        response.write(
          `data: ${JSON.stringify({ type: 'web', state: web.state })}\n\n`,
        );
        clients.add(response);
        const heartbeat = setInterval(
          () => response.write(': ping\n\n'),
          15_000,
        );
        request.on('close', () => {
          clearInterval(heartbeat);
          clients.delete(response);
        });
        return;
      }
      case 'GET /state':
        return json(response, 200, {
          runtime: runtime.state,
          web: web.state,
          vitals,
          profiles: await profiles(),
          budgets: await readBudgets(),
          simulationActions,
          benchSteps: benchSteps.map(({ id, title, playgroundOnly }) => ({
            id,
            title,
            playgroundOnly: Boolean(playgroundOnly),
          })),
          realRoots: realRoots(),
          benchRunning,
        });
      case 'GET /traces':
        return json(response, 200, { traces: [...traces.values()] });
      case 'DELETE /traces':
        traces.clear();
        broadcast({ type: 'cleared' });
        return json(response, 200, { cleared: true });
      case 'POST /runtime': {
        const { mode } = (await body(request)) as { mode: RuntimeMode };
        if (mode.kind === 'real') {
          const known = new Set(
            (await listRepositories()).map((repo) => repo.path),
          );
          if (
            !mode.repositories.length ||
            mode.repositories.some((repo) => !known.has(repo))
          )
            return json(response, 400, { error: 'Unknown repository.' });
        }
        void startRuntime(mode);
        return json(response, 202, { starting: true });
      }
      case 'POST /runtime/stop':
        await stopRuntime();
        return json(response, 200, { stopped: true });
      case 'POST /web': {
        const { action } = (await body(request)) as {
          action: 'start' | 'stop';
        };
        if (action === 'stop') await stopWeb();
        else startWeb();
        return json(response, 200, web.state);
      }
      case 'GET /repos':
        return json(response, 200, { repositories: await listRepositories() });
      case 'POST /repos/measure': {
        const input = (await body(request)) as {
          path?: string;
          workingTree?: boolean;
        };
        const state = runtime.state;
        const allowed = new Set([
          ...(await listRepositories()).map((repo) => repo.path),
          ...(state.status === 'ready' && state.mode.kind === 'playground'
            ? state.worktrees.map((worktree) => worktree.path)
            : []),
        ]);
        if (!input.path || !allowed.has(input.path))
          return json(response, 400, { error: 'Unknown repository.' });
        return json(
          response,
          200,
          await measureRepository(input.path, {
            workingTree: Boolean(input.workingTree),
          }),
        );
      }
      case 'POST /simulate': {
        const input = (await body(request)) as {
          worktree?: string;
          action?: SimulationAction;
          count?: number;
        };
        const state = runtime.state;
        if (
          state.status !== 'ready' ||
          state.mode.kind !== 'playground' ||
          !state.playgroundRoot
        )
          return json(response, 409, {
            error: 'Simulation only runs on a playground.',
          });
        const worktree = state.worktrees.find(
          (candidate) => candidate.path === input.worktree,
        );
        const action = simulationActions.find(
          (candidate) => candidate.action === input.action,
        );
        if (!worktree || !action)
          return json(response, 400, { error: 'Unknown worktree or action.' });
        try {
          const message = await simulate(
            state.playgroundRoot,
            worktree.path,
            action.action,
            Math.max(1, Math.min(500, Number(input.count ?? 5))),
          );
          broadcast({ type: 'simulation', message, ok: true });
          return json(response, 200, { message });
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          broadcast({ type: 'simulation', message, ok: false });
          return json(response, 500, { error: message });
        }
      }
      case 'GET /bench':
        return json(response, 200, {
          runs: benchHistory,
          running: benchRunning,
        });
      case 'POST /bench': {
        const { targets } = (await body(request)) as {
          targets?: RuntimeMode[];
        };
        if (benchRunning)
          return json(response, 409, {
            error: 'A benchmark is already running.',
          });
        void bench(targets).catch((error) =>
          broadcast({
            type: 'simulation',
            message: `Benchmark failed: ${error instanceof Error ? error.message : error}`,
            ok: false,
          }),
        );
        return json(response, 202, { started: true });
      }
      case 'GET /budgets':
        return json(response, 200, await readBudgets());
      case 'PUT /budgets': {
        const budgets = await body(request);
        await writeFile(budgetsFile, `${JSON.stringify(budgets, null, 2)}\n`);
        return json(response, 200, budgets);
      }
      case 'GET /source': {
        const file = url.searchParams.get('path') ?? '';
        return json(response, 200, {
          path: file,
          content: await readSource(file),
        });
      }
      default:
        return json(response, 404, { error: `No lab route ${route}` });
    }
  } catch (error) {
    const status = (error as { status?: number }).status ?? 500;
    if (!response.headersSent)
      json(response, status, {
        error: error instanceof Error ? error.message : String(error),
      });
  }
});

await new Promise<void>((done) => server.listen(port, '127.0.0.1', done));
process.stdout.write(`Server lab: http://127.0.0.1:${port}\n`);

const initial =
  process.env.LAB_PROFILE ?? ('app' in (await profiles()) ? 'app' : 'fixture');
void startRuntime({ kind: 'playground', profile: initial });
if (process.env.LAB_WEB !== '0') startWeb();

let stopping = false;
const stop = async () => {
  if (stopping) return;
  stopping = true;
  process.stdout.write('Stopping the lab…\n');
  for (const client of clients) client.end();
  await Promise.allSettled([stopRuntime(), stopWeb(), vite.close()]);
  server.close();
  process.exit(0);
};
process.on('SIGINT', () => void stop());
process.on('SIGTERM', () => void stop());
