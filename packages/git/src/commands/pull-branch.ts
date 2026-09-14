import type { GitActionCommand, GitActionOutcome } from '../dtos/git-action.ts';
import type { GitActionSnapshot } from '../dtos/git-action-snapshot.ts';
import type { GitProcessRunner } from '../interfaces/git-process-runner.ts';
import { processFailure } from './action-outcome.ts';
import { fetchBranch } from './fetch-branch.ts';
import { readActionCommand } from './read-action-command.ts';

export async function pullBranch(
  process: GitProcessRunner,
  preparation: GitActionCommand,
  snapshot: GitActionSnapshot,
  signal: AbortSignal,
): Promise<GitActionOutcome> {
  if (preparation.intent.action !== 'pull')
    throw new Error('Invalid pull intent');
  const fetched = await fetchBranch(
    process,
    { ...preparation, intent: { ...preparation.intent, action: 'fetch' } },
    snapshot,
    signal,
  );
  if (fetched.state !== 'succeeded' && fetched.state !== 'no-change')
    return fetched;
  const candidate = fetched.result?.trackingOid;
  if (!candidate)
    return {
      state: 'indeterminate',
      reason: 'OUTCOME_UNKNOWN',
      refreshRequired: true,
    };
  const head = (
    await readActionCommand(process, ['rev-parse', '--verify', 'HEAD'], signal)
  ).trimEnd();
  const branch = (
    await readActionCommand(
      process,
      ['symbolic-ref', '--quiet', 'HEAD'],
      signal,
    )
  ).trimEnd();
  const status = await readActionCommand(
    process,
    ['status', '--porcelain=v1', '-z', '--untracked-files=all'],
    signal,
  );
  if (
    head !== preparation.preview.headOid ||
    branch !== preparation.preview.branch ||
    status
  )
    return {
      state: 'rejected',
      reason: 'STALE_PREPARATION',
      refreshRequired: true,
    };
  if (head === candidate)
    return {
      state: 'no-change',
      result: { headOid: head },
      refreshRequired: true,
    };
  const ancestry = await process.execute(
    ['merge-base', '--is-ancestor', head, candidate],
    signal,
  );
  const ancestryFailure = processFailure(ancestry);
  if (ancestryFailure)
    return ancestry.exitCode === 1 && !ancestry.interrupted
      ? { state: 'rejected', reason: 'NON_FAST_FORWARD', refreshRequired: true }
      : ancestryFailure;
  const merged = await process.execute(
    ['merge', '--ff-only', '--no-edit', '--no-stat', candidate],
    signal,
  );
  const failure = processFailure(merged);
  if (failure) return failure;
  const result = (
    await readActionCommand(process, ['rev-parse', '--verify', 'HEAD'], signal)
  ).trimEnd();
  return result === candidate
    ? {
        state: 'succeeded',
        result: { headOid: result, trackingOid: candidate },
        refreshRequired: true,
      }
    : {
        state: 'indeterminate',
        reason: 'OUTCOME_UNKNOWN',
        refreshRequired: true,
      };
}
