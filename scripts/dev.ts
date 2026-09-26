import { spawn, type ChildProcess } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const webRoot = resolve(root, 'apps/web');
const readySchema = z.object({ address: z.string().url() });

function exitOf(child: ChildProcess): Promise<number> {
  return new Promise((done) => {
    child.once('error', (error) => {
      process.stderr.write(`${error.message}\n`);
      done(1);
    });
    child.once('close', (code) => done(code ?? 1));
  });
}

async function main(): Promise<void> {
  const server = spawn(
    process.execPath,
    [resolve(root, 'scripts/dev-server.ts')],
    {
      cwd: root,
      detached: true,
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
    const ready = new Promise<string>((done) => {
      const lines = createInterface({ input: server.stdout });
      lines.on('line', (line) => {
        process.stdout.write(`${line}\n`);
        try {
          const ready = readySchema.safeParse(JSON.parse(line));
          if (ready.success) done(ready.data.address);
        } catch {
          return;
        }
      });
    });
    const address = await Promise.race([
      ready,
      serverExit.then((code) => {
        throw new Error(`Development server exited before ready (${code}).`);
      }),
    ]);
    if (stopping) return;
    web = spawn(resolve(webRoot, 'node_modules/.bin/vite'), [], {
      cwd: webRoot,
      detached: true,
      env: { ...process.env, PORCELAIN_API_TARGET: address },
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

await main();
