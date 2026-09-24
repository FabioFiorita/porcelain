import { spawn } from 'node:child_process';
import type { Readable } from 'node:stream';
import { setTimeout as delay } from 'node:timers/promises';

export type RunCommandInput = {
  command: string;
  args: readonly string[];
  cwd?: string | undefined;
  env?: NodeJS.ProcessEnv | undefined;
  stdin?: string | Buffer | undefined;
  timeoutMs?: number | undefined;
  maxBytes: number;
  onStderr?: ((chunk: Buffer) => void) | undefined;
};

export type CommandStop = 'aborted' | 'deadline' | 'output-limit' | 'lingering';

export type CommandOutput = {
  stdout: Buffer;
  stderr: Buffer;
  exitCode: number | undefined;
  stopped: CommandStop | undefined;
  groupStopped: boolean;
};

const LINGER_MS = 250;
const CLEANUP_MS = 5000;

export async function runCommand(
  input: RunCommandInput,
  signal?: AbortSignal,
): Promise<CommandOutput> {
  signal?.throwIfAborted();
  const child = spawn(input.command, [...input.args], {
    cwd: input.cwd,
    env: input.env,
    detached: true,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  let stopped: CommandStop | undefined;
  const stop = (reason: CommandStop) => {
    stopped ??= reason;
    if (child.pid !== undefined) signalGroup(child.pid, 'SIGKILL');
  };
  const collect = (stream: Readable, observe?: (chunk: Buffer) => void) => {
    const chunks: Buffer[] = [];
    let bytes = 0;
    stream.on('data', (chunk: Buffer) => {
      observe?.(chunk);
      bytes += chunk.length;
      if (bytes > input.maxBytes) stop('output-limit');
      else chunks.push(chunk);
    });
    return chunks;
  };
  const stdout = collect(child.stdout);
  const stderr = collect(child.stderr, input.onStderr);
  const closed = new Promise<boolean>((resolve) =>
    child.once('close', () => resolve(true)),
  );
  const abort = () => stop('aborted');
  signal?.addEventListener('abort', abort, { once: true });
  const deadline =
    input.timeoutMs === undefined
      ? undefined
      : setTimeout(() => stop('deadline'), input.timeoutMs);
  child.stdin.on('error', () => {});
  child.stdin.end(input.stdin);
  try {
    const exitCode = await new Promise<number | undefined>(
      (resolve, reject) => {
        child.once('error', reject);
        child.once('exit', (code) => resolve(code ?? undefined));
      },
    );
    const pid = child.pid;
    if (pid !== undefined && !(await groupEnds(pid, LINGER_MS)))
      stop('lingering');
    const groupStopped =
      (pid === undefined || (await groupEnds(pid, CLEANUP_MS))) &&
      (await Promise.race([closed, delay(CLEANUP_MS, false, { ref: false })]));
    child.stdout.destroy();
    child.stderr.destroy();
    return {
      stdout: Buffer.concat(stdout),
      stderr: Buffer.concat(stderr),
      exitCode,
      stopped,
      groupStopped,
    };
  } finally {
    clearTimeout(deadline);
    signal?.removeEventListener('abort', abort);
  }
}

async function groupEnds(pid: number, withinMs: number): Promise<boolean> {
  const deadline = Date.now() + withinMs;
  while (signalGroup(pid, 0)) {
    if (Date.now() >= deadline) return false;
    await delay(10);
  }
  return true;
}

function signalGroup(pid: number, signal: NodeJS.Signals | 0): boolean {
  try {
    process.kill(-pid, signal);
    return true;
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ESRCH')
      return false;
    if (error instanceof Error && 'code' in error && error.code === 'EPERM')
      return true;
    throw error;
  }
}
