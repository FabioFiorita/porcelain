import type { GitActionCommand, GitActionOutcome } from '../dtos/git-action.ts';
import { GitActionRejectedError } from '../errors/git-action-rejected-error.ts';
import type { GitProcessRunner } from '../interfaces/git-process-runner.ts';
import { processFailure } from '../parsers/parse-process-result.ts';
import { readActionCommand } from './read-action-command.ts';

export async function manageBranch(
  process: GitProcessRunner,
  command: GitActionCommand<'switch-branch' | 'create-branch'>,
  signal: AbortSignal,
): Promise<GitActionOutcome> {
  const intent = command.intent;
  const valid = await process.execute(
    ['check-ref-format', '--branch', intent.branch],
    signal,
  );
  const invalid = processFailure(valid);
  if (invalid?.state === 'indeterminate') return invalid;
  if (invalid)
    throw new GitActionRejectedError('UNSUPPORTED_CONFIGURATION', {
      detail: `\`${intent.branch}\` is not a valid branch name. Choose another name.`,
    });
  const args =
    intent.action === 'switch-branch'
      ? ['switch', '--no-guess', intent.branch]
      : intent.switchTo
        ? ['switch', '--create', intent.branch]
        : ['branch', intent.branch, 'HEAD'];
  const switched = await process.execute(args, signal);
  const failure = processFailure(switched);
  if (failure) return failure;
  const headOid = (
    await readActionCommand(process, ['rev-parse', '--verify', 'HEAD'], signal)
  ).trimEnd();
  return {
    state: 'succeeded',
    result: { headOid, branch: intent.branch },
    refreshRequired: true,
  };
}
