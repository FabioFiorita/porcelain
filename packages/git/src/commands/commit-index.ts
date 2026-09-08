import type { GitActionCommand, GitActionOutcome } from '../dtos/git-action.ts';
import type { GitProcessRunner } from '../interfaces/git-process-runner.ts';
import { processFailure } from './action-outcome.ts';
import { readActionCommand } from './read-action-command.ts';

export async function commitIndex(
  process: GitProcessRunner,
  preparation: GitActionCommand,
  signal: AbortSignal,
): Promise<GitActionOutcome> {
  if (preparation.intent.action !== 'commit')
    throw new Error('Invalid commit intent');
  if (!preparation.preview.staged)
    return { state: 'no-change', refreshRequired: false };
  const command = await process.execute(
    ['commit', '--file=-', '--cleanup=verbatim'],
    signal,
    preparation.intent.message,
  );
  const failure = processFailure(command);
  if (failure) return failure;
  const headOid = (
    await readActionCommand(process, ['rev-parse', '--verify', 'HEAD'], signal)
  ).trimEnd();
  if (headOid === preparation.preview.headOid)
    return {
      state: 'indeterminate',
      reason: 'OUTCOME_UNKNOWN',
      refreshRequired: true,
    };
  return { state: 'succeeded', result: { headOid }, refreshRequired: true };
}
