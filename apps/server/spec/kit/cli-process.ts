import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { NodeServices } from '@effect/platform-node';
import { Clock, Effect, Layer } from 'effect';
import { LIMITS } from '../../src/config/limits.ts';
import { createCliRunner } from '../../src/cli/runner.ts';
import { CliRuntime } from '../../src/cli/runner.ts';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repository = fileURLToPath(new URL('../../../../', import.meta.url));
const PROGRAM = `
import { Effect } from 'effect';
import { writeFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { join } from 'node:path';
import { runCli } from './apps/server/src/bootstrap/main.ts';
import { runMain } from './apps/server/src/cli/runner.ts';
const root = process.argv[1];
runMain(runCli(['serve', '--port', '0', '--data-directory', join(root, 'data')], { PORCELAIN_PROJECT_HOME: root }, { homeDirectory: root }).pipe(
  Effect.ensuring(Effect.promise(async () => {
    await delay(100);
    await writeFile(join(root, 'drained'), 'drained');
  })),
));
`;

export function cliProcess(root: string) {
  const child = spawn(
    process.execPath,
    ['--input-type=module', '--eval', PROGRAM, root],
    { cwd: repository, stdio: ['ignore', 'pipe', 'pipe'] },
  );
  let output = '';
  let errors = '';
  const ready = Promise.withResolvers<string>();
  child.stdout.on('data', (chunk: Buffer) => {
    output += chunk.toString();
    const address = /Porcelain listening at (http:\/\/[^\s]+)/.exec(
      output,
    )?.[1];
    if (address !== undefined) ready.resolve(address);
  });
  child.stderr.on('data', (chunk: Buffer) => {
    errors += chunk.toString();
  });
  child.once('error', ready.reject);
  const exited = new Promise<{
    code: number | null;
    signal: NodeJS.Signals | null;
  }>((resolve) =>
    child.once('close', (code, signal) => {
      ready.reject(
        new Error(`CLI exited before listening: ${errors || output}`),
      );
      resolve({ code, signal });
    }),
  );
  return { process: child, ready: ready.promise, exited, stderr: () => errors };
}

function cliRunner() {
  return createCliRunner(
    Layer.effect(
      CliRuntime,
      Effect.gen(function* () {
        return {
          startServer: () => Effect.die(new Error('Serve was not requested')),
          ownerProbe: {
            probe: () => Effect.succeed({ kind: 'absent' as const }),
          },
          clock: yield* Clock.Clock,
          limits: LIMITS,
          actionableErrors: [],
        };
      }),
    ),
    NodeServices.layer,
  );
}

export async function stopCliProcess(signal: 'SIGINT' | 'SIGTERM') {
  const root = await mkdtemp(
    join(process.platform === 'darwin' ? '/tmp' : tmpdir(), 'porcelain-cli-'),
  );
  const child = cliProcess(root);
  try {
    const address = await child.ready;
    const health = (await fetch(`${address}/api/health`)).status;
    const signaled = child.process.kill(signal);
    const exit = await child.exited;
    const marker = await readFile(join(root, 'drained'), 'utf8');
    const stopped = await fetch(`${address}/api/health`).then(
      () => false,
      () => true,
    );
    return {
      signal,
      health,
      signaled,
      exit,
      marker,
      locked: existsSync(join(root, 'data', 'server.lock')),
      socket: existsSync(join(root, 'data', 'server.sock')),
      stopped,
      stderr: child.stderr(),
    };
  } finally {
    if (child.process.exitCode === null && child.process.signalCode === null) {
      child.process.kill('SIGTERM');
      await child.exited;
    }
    await rm(root, { recursive: true, force: true });
  }
}

export async function cliHelpAndErrors() {
  const output: string[] = [];
  const errors: string[] = [];
  const runCli = cliRunner();
  const options = {
    stdout: (message: string) => output.push(message),
    stderr: (message: string) => errors.push(message),
  };
  const help = await Effect.runPromise(runCli(['--help'], {}, options));
  const invalidFlag = await Effect.runPromise(
    runCli(['--no-such-flag'], {}, options),
  );
  const invalidPort = await Effect.runPromise(
    runCli(['--port', 'invalid'], {}, options),
  );
  return {
    help,
    invalidFlag,
    invalidPort,
    output: output.join(''),
    errors: errors.join(''),
  };
}
