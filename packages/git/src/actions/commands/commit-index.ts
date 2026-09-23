import type { GitActionCommand, GitActionOutcome } from '../dtos/git-action.ts';
import type { GitProcessRunner } from '../interfaces/git-process-runner.ts';
import { processFailure } from '../parsers/parse-process-result.ts';
import { commitPaths } from './commit-paths.ts';
import { readActionCommand } from './read-action-command.ts';

export async function commitIndex(
  process: GitProcessRunner,
  command: GitActionCommand<'commit' | 'amend'>,
  signal: AbortSignal,
  verifyTarget?: () => Promise<void>,
): Promise<GitActionOutcome> {
  const { intent, preview } = command;
  if (intent.paths)
    return commitPaths(process, command, intent.paths, signal, verifyTarget);
  if (!preview.staged) return { state: 'no-change', refreshRequired: false };
  const committed = await process.execute(
    ['commit', '--file=-', '--cleanup=verbatim'],
    signal,
    intent.message,
  );
  const failure = processFailure(committed);
  if (failure) return failure;
  const headOid = (
    await readActionCommand(process, ['rev-parse', '--verify', 'HEAD'], signal)
  ).trimEnd();
  if (headOid === preview.headOid)
    return {
      state: 'indeterminate',
      reason: 'OUTCOME_UNKNOWN',
      refreshRequired: true,
    };
  return { state: 'succeeded', result: { headOid }, refreshRequired: true };
}
