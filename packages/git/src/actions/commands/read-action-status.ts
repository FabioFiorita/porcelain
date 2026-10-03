import { type GitChange, parseGitStatus } from '../../inspection/index.ts';
import type { GitProcessRunner } from '../interfaces/git-process-runner.ts';
import { readActionCommand } from './read-action-command.ts';

export async function readActionStatus(
  process: GitProcessRunner,
  signal: AbortSignal,
): Promise<GitChange[]> {
  const output = await readActionCommand(
    process,
    [
      'status',
      '--porcelain=v2',
      '-z',
      '--branch',
      '--no-ahead-behind',
      '--untracked-files=all',
      '--find-renames',
    ],
    signal,
  );
  return parseGitStatus(Buffer.from(output), process.limits).changes;
}
