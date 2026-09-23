import type { GitActionCommand, GitActionOutcome } from '../dtos/git-action.ts';
import type { GitProcessRunner } from '../interfaces/git-process-runner.ts';
import { processFailure } from '../parsers/parse-process-result.ts';
import { readActionCommand } from './read-action-command.ts';

export async function createStash(
  process: GitProcessRunner,
  command: GitActionCommand<'stash-create'>,
  signal: AbortSignal,
): Promise<GitActionOutcome> {
  const { intent, preview } = command;
  if (
    !preview.trackedChanges &&
    !(intent.includeUntracked && preview.untrackedCount)
  )
    return { state: 'no-change', refreshRequired: false };
  const pushed = await process.execute(
    [
      'stash',
      'push',
      ...(intent.includeUntracked ? ['--include-untracked'] : []),
      '--message',
      intent.message,
    ],
    signal,
  );
  const failure = processFailure(pushed);
  if (failure) return failure;
  const stashOid = (
    await readActionCommand(
      process,
      ['rev-parse', '--verify', 'refs/stash'],
      signal,
    )
  ).trimEnd();
  return {
    state: 'succeeded',
    result: { stashOid, stashRetained: true },
    refreshRequired: true,
  };
}
