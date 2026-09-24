import { runCommand } from '@porcelain/process';
import { ProviderProcessFailedError } from '../errors/provider-process-failed-error.ts';

const PROCESS_DEADLINE_MS = 120_000;

export type ProviderCommand = {
  command: string;
  args: readonly string[];
  cwd: string;
  prompt: string;
  maxBytes: number;
};

export async function runProvider(
  input: ProviderCommand,
  signal?: AbortSignal,
): Promise<string> {
  signal?.throwIfAborted();
  const output = await runCommand(
    {
      command: input.command,
      args: input.args,
      cwd: input.cwd,
      stdin: input.prompt,
      timeoutMs: PROCESS_DEADLINE_MS,
      maxBytes: input.maxBytes,
    },
    signal,
  ).catch((cause: unknown) => {
    signal?.throwIfAborted();
    throw new ProviderProcessFailedError({ cause });
  });
  if (output.exitCode === 0 && output.stopped !== 'output-limit')
    return output.stdout.toString('utf8');
  signal?.throwIfAborted();
  throw new ProviderProcessFailedError();
}
