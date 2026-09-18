import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import {
  isPlaygroundProfileName,
  type PlaygroundProfileName,
  playgroundProfiles,
} from '../apps/server/src/development/profiles.ts';

export async function runWebPlayground(options: {
  preview: boolean;
  directory: string;
  signal: AbortSignal;
  port: number;
  manifest?: string;
  manual?: boolean;
  profile?: PlaygroundProfileName;
}) {
  const { preview, directory, signal, port, manifest } = options;
  await mkdir(directory, { recursive: true });
  const backend = spawn(
    process.execPath,
    ['apps/server/src/development/playground.ts'],
    {
      stdio: ['ignore', 'pipe', 'inherit'],
      env: {
        ...process.env,
        PORCELAIN_PLAYGROUND_DIRECTORY: directory,
        PORCELAIN_PLAYGROUND_PROFILE: options.profile ?? 'fixture',
      },
    },
  );
  const backendExit = once(backend, 'exit');
  const lines = createInterface({ input: backend.stdout });
  try {
    // Generating a large profile takes a while; cancellation must not wait for it.
    const [line] = await Promise.race([
      once(lines, 'line'),
      backendExit.then(() => {
        throw new Error('Playground server exited before startup');
      }),
      new Promise<never>((_, reject) => {
        const cancel = () => reject(new Error('Startup cancelled'));
        if (signal.aborted) cancel();
        else signal.addEventListener('abort', cancel, { once: true });
      }),
    ]);
    const info = JSON.parse(line as string) as {
      address: string;
      tokenFile: string;
      profile: PlaygroundProfileName;
    };
    if (signal.aborted) throw new Error('Startup cancelled');
    if (manifest)
      await writeFile(manifest, JSON.stringify(info), { mode: 0o600 });
    process.stdout.write(
      `Playground profile: ${info.profile}\nAccess token file: ${info.tokenFile}\n`,
    );
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
          PORCELAIN_API_TARGET: info.address,
          PORCELAIN_PLAYGROUND_TOKEN_FILE: !preview ? info.tokenFile : '',
          PORCELAIN_PLAYGROUND_BRIDGE: !preview ? '1' : '0',
          PORCELAIN_PLAYGROUND_AUTO_CONNECT:
            !preview && !options.manual ? '1' : '0',
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
  manual?: boolean;
  profile?: PlaygroundProfileName;
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

/**
 * `pnpm dev` opens the realistic `app` profile. Only `--profile=` overrides it:
 * preview and runs redirected with PORCELAIN_PLAYGROUND_DIRECTORY keep the small
 * `fixture`, because the browser smoke starts `pnpm dev` that way.
 */
export function playgroundProfile(
  argv: readonly string[],
  environment: NodeJS.ProcessEnv,
) {
  const profile =
    argv.find((arg) => arg.startsWith('--profile='))?.slice(10) ||
    (argv.includes('--preview') || environment.PORCELAIN_PLAYGROUND_DIRECTORY
      ? 'fixture'
      : 'app');
  if (!isPlaygroundProfileName(profile))
    throw new Error(
      `Unknown playground profile "${profile}". Choose one of: ${Object.keys(playgroundProfiles).join(', ')}.`,
    );
  return profile;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const preview = process.argv.includes('--preview');
  let profile: PlaygroundProfileName | undefined;
  try {
    profile = playgroundProfile(process.argv, process.env);
  } catch (error) {
    console.error((error as Error).message);
  }
  process.exitCode = !profile
    ? 1
    : await runWebPlaygroundCli({
        preview,
        profile,
        directory:
          process.env.PORCELAIN_PLAYGROUND_DIRECTORY ||
          (preview ? tmpdir() : resolve('.playgrounds')),
        port: Number(
          process.argv.find((arg) => arg.startsWith('--port='))?.slice(7) ??
            (preview ? 4173 : 5173),
        ),
        manual: process.argv.includes('--manual'),
        ...(process.env.PORCELAIN_PLAYGROUND_INFO
          ? { manifest: process.env.PORCELAIN_PLAYGROUND_INFO }
          : {}),
      });
}
