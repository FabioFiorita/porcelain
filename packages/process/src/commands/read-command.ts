import { execFileSync } from 'node:child_process';

export function readCommand(input: {
  command: string;
  args: readonly string[];
  timeoutMs: number;
  maxBytes: number;
}): string {
  return execFileSync(input.command, input.args, {
    encoding: 'utf8',
    timeout: input.timeoutMs,
    maxBuffer: input.maxBytes,
    stdio: ['ignore', 'pipe', 'ignore'],
  });
}
