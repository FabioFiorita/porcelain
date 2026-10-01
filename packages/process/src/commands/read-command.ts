import { execFileSync } from 'node:child_process';

export function readCommand(input: {
  command: string;
  args: readonly string[];
  timeoutMs: number;
  maxBytes: number;
  input?: string;
}): string {
  return execFileSync(input.command, input.args, {
    encoding: 'utf8',
    timeout: input.timeoutMs,
    maxBuffer: input.maxBytes,
    ...(input.input === undefined
      ? { stdio: ['ignore', 'pipe', 'ignore'] }
      : { input: input.input, stdio: ['pipe', 'pipe', 'ignore'] }),
  });
}
