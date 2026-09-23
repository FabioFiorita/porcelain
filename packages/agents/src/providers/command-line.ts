import { spawn } from 'node:child_process';
import { constants } from 'node:fs';
import { access, stat } from 'node:fs/promises';
import { delimiter, join } from 'node:path';
import { ProviderProcessFailedError } from './provider-process-failed-error.ts';

const PROCESS_DEADLINE_MS = 120_000;
const MAX_OUTPUT_BYTES = 1024 * 1024;

export async function findExecutable(
  name: string,
): Promise<string | undefined> {
  for (const directory of (process.env.PATH ?? '')
    .split(delimiter)
    .filter(Boolean)) {
    const path = join(directory, name);
    try {
      await access(path, constants.X_OK);
      if ((await stat(path)).isFile()) return path;
    } catch {}
  }
  return undefined;
}

export async function runCommandLine(
  command: string,
  args: readonly string[],
  cwd: string,
  input: string,
  signal?: AbortSignal,
): Promise<string> {
  signal?.throwIfAborted();
  const child = spawn(command, args, {
    cwd,
    detached: true,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  const stopGroup = () => {
    if (!child.pid) return;
    try {
      process.kill(-child.pid, 'SIGKILL');
    } catch (error) {
      if (
        !(error instanceof Error && 'code' in error && error.code === 'ESRCH')
      )
        child.kill('SIGKILL');
    }
  };
  const timer = setTimeout(stopGroup, PROCESS_DEADLINE_MS);
  signal?.addEventListener('abort', stopGroup, { once: true });
  child.once('exit', stopGroup);
  child.stdin.on('error', () => {});
  try {
    return await new Promise<string>((resolve, reject) => {
      const chunks: Buffer[] = [];
      let bytes = 0;
      let overflow = false;
      child.stdout.on('data', (chunk: Buffer) => {
        bytes += chunk.length;
        if (bytes > MAX_OUTPUT_BYTES) {
          overflow = true;
          stopGroup();
        } else chunks.push(chunk);
      });
      child.stderr.resume();
      child.once('error', reject);
      child.once('close', (code) => {
        if (code === 0 && !overflow)
          resolve(Buffer.concat(chunks).toString('utf8'));
        else reject(new Error('Generation process failed'));
      });
      child.stdin.end(input);
      if (signal?.aborted) stopGroup();
    });
  } catch (cause) {
    signal?.throwIfAborted();
    throw new ProviderProcessFailedError({ cause });
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', stopGroup);
  }
}
