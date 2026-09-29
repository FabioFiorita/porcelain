import { runCommand, type ProcessGroupLimits } from '@porcelain/process';

export type TailscaleLimits = {
  httpsPort: number;
  commandTimeoutMs: number;
  outputBytes: number;
  processGroup: ProcessGroupLimits;
};

export type TailscaleRun =
  | { kind: 'missing' }
  | { kind: 'failed'; denied: boolean }
  | { kind: 'done'; stdout: string };

const COMMAND = 'tailscale';
const DENIED = /access denied|permission denied|operator/i;

function missingCommand(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}

export async function runTailscale(
  args: readonly string[],
  limits: TailscaleLimits,
  signal?: AbortSignal,
): Promise<TailscaleRun> {
  try {
    const output = await runCommand(
      {
        command: COMMAND,
        args,
        timeoutMs: limits.commandTimeoutMs,
        maxBytes: limits.outputBytes,
        processGroup: limits.processGroup,
      },
      signal,
    );
    signal?.throwIfAborted();
    const completed =
      output.stopped === undefined || output.stopped === 'lingering';
    if (completed && output.exitCode === 0)
      return { kind: 'done', stdout: output.stdout.toString('utf8') };
    return {
      kind: 'failed',
      denied: DENIED.test(output.stderr.toString('utf8')),
    };
  } catch (error) {
    if (missingCommand(error)) return { kind: 'missing' };
    signal?.throwIfAborted();
    return { kind: 'failed', denied: false };
  }
}
