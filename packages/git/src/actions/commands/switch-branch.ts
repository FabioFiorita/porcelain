import { Effect } from 'effect';
import type { ActionFailure, ActionPlatform } from '../dtos/action-failure.ts';
import type { GitActionCommand, GitActionOutcome } from '../dtos/git-action.ts';
import type { GitProcessRunner } from '../interfaces/git-process-runner.ts';
import { GitActionRejectedError } from '../../shared/errors/git-action-rejected-error.ts';
import { readActionCommand } from './read-action-command.ts';
import { processFailure } from '../parsers/parse-process-result.ts';
export const switchBranch = Effect.fn('Git.switchBranch')(function* (
  process: GitProcessRunner,
  preparation: GitActionCommand<'switch'>,
): Effect.fn.Return<GitActionOutcome, ActionFailure, ActionPlatform> {
  const ref = preparation.intent.targetRef;
  if (!ref.startsWith('refs/heads/'))
    return yield* new GitActionRejectedError({ reason: 'GIT_REJECTED' });
  const branch = ref.slice('refs/heads/'.length);
  yield* readActionCommand(process, ['check-ref-format', '--branch', branch]);
  yield* readActionCommand(process, [
    'rev-parse',
    '--verify',
    `${ref}^{commit}`,
  ]);
  if (preparation.preview.branch === ref)
    return { state: 'no-change', refreshRequired: false };
  const changed = yield* process.execute([
    'switch',
    '--no-guess',
    '--',
    branch,
  ]);
  const failure = processFailure(changed);
  if (failure) return failure;
  const observed = (yield* readActionCommand(process, [
    'symbolic-ref',
    '--quiet',
    'HEAD',
  ])).trimEnd();
  if (observed !== ref)
    return {
      state: 'indeterminate',
      reason: 'OUTCOME_UNKNOWN',
      refreshRequired: true,
    };
  const headOid = (yield* readActionCommand(process, [
    'rev-parse',
    '--verify',
    'HEAD',
  ])).trimEnd();
  return {
    state: 'succeeded',
    refreshRequired: true,
    result: { branch, headOid },
  };
});
