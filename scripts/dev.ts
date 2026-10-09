import { Schema, Result } from 'effect';
import { spawn, type ChildProcess } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { parseArgs } from 'node:util';
import {
  electronExecutable,
  root,
  stageDesktop,
} from '../apps/desktop/spec/kit/stage.ts';
const webRoot = resolve(root, 'apps/web');
const vite = resolve(webRoot, 'node_modules/.bin/vite');
const readySchema = Schema.Struct({
  address: Schema.String.check(
    Schema.makeFilter((value) =>
      Result.isSuccess(Schema.decodeUnknownResult(Schema.URLFromString)(value)),
    ),
  ),
  manifest: Schema.String,
});
const manifestSchema = Schema.fromJsonString(
  Schema.Struct({ socketPath: Schema.String }),
);
const { values } = parseArgs({
  options: { desktop: { type: 'boolean', default: false } },
});
function exitOf(child: ChildProcess): Promise<number> {
  return new Promise((done) => {
    child.once('error', (error) => {
      process.stderr.write(`${error.message}\n`);
      done(1);
    });
    child.once('close', (code) => done(code ?? 1));
  });
}
function freePort(): Promise<number> {
  return new Promise((done, fail) => {
    const probe = createServer();
    probe.once('error', fail);
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      probe.close(() =>
        typeof address === 'object' && address !== null
          ? done(address.port)
          : fail(new Error('No free port for the development web')),
      );
    });
  });
}
async function webReady(origin: string, exited: Promise<number>) {
  let stopped = false;
  void exited.then(() => {
    stopped = true;
  });
  for (const deadline = Date.now() + 60_000; Date.now() < deadline;) {
    if (stopped) throw new Error('Vite exited before it was ready.');
    const answer = await fetch(origin).catch(() => undefined);
    if (answer?.ok) return;
    await new Promise((done) => setTimeout(done, 250));
  }
  throw new Error(`Vite did not answer at ${origin}.`);
}
async function desktop(): Promise<void> {
  const app = resolve(root, 'dist/desktop/development');
  await stageDesktop({
    directory: app,
    productName: 'Porcelain Dev',
    web: false,
  });
  const port = await freePort();
  const origin = `http://127.0.0.1:${port}`;
  const web = spawn(vite, ['--mode', 'desktop'], {
    cwd: webRoot,
    detached: true,
    env: { ...process.env, PORCELAIN_DESKTOP_WEB_PORT: `${port}` },
    stdio: 'inherit',
  });
  const webExit = exitOf(web);
  let electron: ChildProcess | undefined;
  let stopping = false;
  const stop = () => {
    if (stopping) return;
    stopping = true;
    electron?.kill('SIGTERM');
    web.kill('SIGTERM');
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  try {
    await webReady(origin, webExit);
    if (stopping) return;
    const environment: Record<string, string> = {};
    for (const [name, value] of Object.entries(process.env))
      if (value !== undefined && name !== 'ELECTRON_RUN_AS_NODE')
        environment[name] = value;
    electron = spawn(electronExecutable(), [app, '--web-dev-server', origin], {
      cwd: root,
      env: environment,
      stdio: 'inherit',
    });
    const appExit = exitOf(electron);
    const first = await Promise.race([appExit, webExit]);
    if (!stopping) process.exitCode = first;
    stop();
    await Promise.all([appExit, webExit]);
  } catch (error) {
    if (!stopping) {
      process.stderr.write(
        `${error instanceof Error ? error.message : String(error)}\n`,
      );
      process.exitCode = 1;
    }
  } finally {
    stop();
    await webExit;
    process.off('SIGINT', stop);
    process.off('SIGTERM', stop);
  }
}
async function browser(): Promise<void> {
  const server = spawn(
    process.execPath,
    [resolve(root, 'apps/server/spec/kit/sandbox.ts')],
    {
      cwd: root,
      detached: true,
      env: { ...process.env, PORCELAIN_DEV_SAMPLE: 'review' },
      stdio: ['inherit', 'pipe', 'inherit'],
    },
  );
  const serverExit = exitOf(server);
  let web: ChildProcess | undefined;
  let stopping = false;
  const stop = () => {
    if (stopping) return;
    stopping = true;
    web?.kill('SIGTERM');
    server.kill('SIGTERM');
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  try {
    const ready = new Promise<typeof readySchema.Type>((done) => {
      const lines = createInterface({ input: server.stdout });
      lines.on('line', (line) => {
        process.stdout.write(`${line}\n`);
        try {
          const ready = Schema.decodeUnknownResult(readySchema)(
            JSON.parse(line),
          );
          if (Result.isSuccess(ready)) done(ready.success);
        } catch {
          return;
        }
      });
    });
    const started = await Promise.race([
      ready,
      serverExit.then((code) => {
        throw new Error(`Development server exited before ready (${code}).`);
      }),
    ]);
    if (stopping) return;
    web = spawn(vite, [], {
      cwd: webRoot,
      detached: true,
      env: {
        ...process.env,
        PORCELAIN_API_TARGET: started.address,
        PORCELAIN_OWNER_SOCKET: Schema.decodeUnknownSync(manifestSchema)(
          readFileSync(started.manifest, 'utf8'),
        ).socketPath,
      },
      stdio: 'inherit',
    });
    const webExit = exitOf(web);
    const first = await Promise.race([serverExit, webExit]);
    if (!stopping) {
      process.exitCode = first === 0 ? 1 : first;
      stop();
    }
    await Promise.all([serverExit, webExit]);
  } catch (error) {
    if (!stopping) {
      process.stderr.write(
        `${error instanceof Error ? error.message : String(error)}\n`,
      );
      process.exitCode = 1;
    }
  } finally {
    stop();
    await serverExit;
    process.off('SIGINT', stop);
    process.off('SIGTERM', stop);
  }
}
await (values.desktop ? desktop() : browser());
