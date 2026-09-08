import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';

export async function runWebPlayground(options: {
  preview: boolean;
  directory: string;
  signal: AbortSignal;
  port: number;
  manifest?: string;
}) {
  const { preview, directory, signal, port, manifest } = options;
  await mkdir(directory, { recursive: true });
  const backend = spawn(
    process.execPath,
    ['apps/server/src/development/playground.ts'],
    {
      stdio: ['ignore', 'pipe', 'inherit'],
      env: { ...process.env, PORCELAIN_PLAYGROUND_DIRECTORY: directory },
    },
  );
  const backendExit = once(backend, 'exit');
  const lines = createInterface({ input: backend.stdout });
  try {
    const [line] = await Promise.race([
      once(lines, 'line'),
      backendExit.then(() => {
        throw new Error('Playground server exited before startup');
      }),
    ]);
    const info = JSON.parse(line as string) as {
      documentation: string;
      tokenFile: string;
    };
    if (signal.aborted) throw new Error('Startup cancelled');
    if (manifest)
      await writeFile(manifest, JSON.stringify(info), { mode: 0o600 });
    process.stdout.write(`Access token file: ${info.tokenFile}\n`);
    const vite = spawn(
      process.execPath,
      [
        resolve('apps/web/node_modules/vite/bin/vite.js'),
        ...(preview ? ['preview'] : []),
        '--port',
        String(port),
        '--host',
        '127.0.0.1',
        '--strictPort',
      ],
      {
        cwd: resolve('apps/web'),
        stdio: 'inherit',
        env: {
          ...process.env,
          PORCELAIN_API_TARGET: new URL(info.documentation).origin,
        },
      },
    );
    const viteExit = once(vite, 'exit');
    try {
      await Promise.race([
        viteExit,
        backendExit,
        new Promise<void>((done) => {
          if (signal.aborted) done();
          else
            signal.addEventListener('abort', () => done(), {
              once: true,
            });
        }),
      ]);
    } finally {
      vite.kill('SIGTERM');
      await viteExit;
    }
    if (!signal.aborted)
      throw new Error('A playground process exited unexpectedly');
  } finally {
    backend.kill('SIGTERM');
    await backendExit;
    lines.close();
    if (manifest) await rm(manifest, { force: true });
  }
}

export async function runWebPlaygroundCli(options: {
  preview: boolean;
  directory: string;
  port: number;
  manifest?: string;
}) {
  const controller = new AbortController();
  const stop = () => controller.abort();
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  try {
    await runWebPlayground({ ...options, signal: controller.signal });
    return 0;
  } catch (error) {
    if (!controller.signal.aborted) {
      console.error(error);
      return 1;
    }
    return 0;
  } finally {
    process.off('SIGINT', stop);
    process.off('SIGTERM', stop);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const preview = process.argv.includes('--preview');
  process.exitCode = await runWebPlaygroundCli({
    preview,
    directory: preview ? tmpdir() : resolve('.playgrounds'),
    port: preview ? 4173 : 5173,
    ...(process.env.PORCELAIN_PLAYGROUND_INFO
      ? { manifest: process.env.PORCELAIN_PLAYGROUND_INFO }
      : {}),
  });
}
