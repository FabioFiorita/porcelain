import { runCommand } from '@porcelain/process';
import { ProviderProcessFailedError } from '../errors/provider-process-failed-error.ts';

export type ProviderCommand = {
  command: string;
  args: readonly string[];
  cwd: string;
  prompt: string;
  maxBytes: number;
  timeoutMs: number;
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
      timeoutMs: input.timeoutMs,
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
