import type { GitProcessRunner } from '../interfaces/git-process-runner.ts';
import { readActionCommand } from './read-action-command.ts';

export async function readActionHead(
  process: GitProcessRunner,
  signal: AbortSignal,
): Promise<string> {
  return (
    await readActionCommand(process, ['rev-parse', '--verify', 'HEAD'], signal)
  ).trimEnd();
}
