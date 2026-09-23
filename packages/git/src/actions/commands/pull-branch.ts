import type { GitActionCommand, GitActionOutcome } from '../dtos/git-action.ts';
import type { ActionRemote } from '../dtos/git-action-snapshot.ts';
import { GitActionRejectedError } from '../errors/git-action-rejected-error.ts';
import { rejectBusyCheckout } from './reject-busy-checkout.ts';
import type { GitProcessRunner } from '../interfaces/git-process-runner.ts';
import { processFailure } from '../parsers/parse-process-result.ts';
import { fetchBranch } from './fetch-branch.ts';
import { readActionBranch } from './read-action-branch.ts';
import { readActionCommand } from './read-action-command.ts';
import { readActionStatus } from './read-action-status.ts';

export async function pullBranch(
  process: GitProcessRunner,
  preparation: GitActionCommand<'pull'>,
  remote: ActionRemote,
  signal: AbortSignal,
): Promise<GitActionOutcome> {
  const fetched = await fetchBranch(process, preparation, remote, signal);
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
  const branch = await readActionBranch(process, signal);
  const changes = await readActionStatus(process, signal);
  if (
    head !== preparation.preview.headOid ||
    branch !== preparation.preview.branch ||
    changes.length > 0
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
  const strategy = preparation.intent.strategy ?? 'ff-only';
  const ancestry = await process.execute(
    ['merge-base', '--is-ancestor', head, candidate],
    signal,
  );
  const ancestryFailure = processFailure(ancestry);
  if (
    ancestryFailure &&
    (ancestry.exitCode !== 1 || ancestryFailure.state === 'indeterminate')
  )
    return ancestryFailure;
  if (ancestry.exitCode === 1) {
    if (strategy === 'ff-only')
      return {
        state: 'rejected',
        reason: 'NON_FAST_FORWARD',
        refreshRequired: true,
      };
    const ahead = await process.execute(
      ['merge-base', '--is-ancestor', candidate, head],
      signal,
    );
    const aheadFailure = processFailure(ahead);
    if (
      aheadFailure &&
      (ahead.exitCode !== 1 || aheadFailure.state === 'indeterminate')
    )
      return aheadFailure;
    if (ahead.exitCode === 0)
      return {
        state: 'no-change',
        result: { headOid: head, trackingOid: candidate },
        refreshRequired: true,
      };
  }
  const integrated = await process.execute(
    strategy === 'rebase'
      ? [
          'rebase',
          '--no-autostash',
          '--no-autosquash',
          '--no-update-refs',
          '--no-rebase-merges',
          '--no-fork-point',
          candidate,
        ]
      : [
          'merge',
          strategy === 'ff-only' ? '--ff-only' : '--ff',
          '--no-squash',
          '--commit',
          '--no-autostash',
          '--no-edit',
          '--no-stat',
          candidate,
        ],
    signal,
  );
  const failure = processFailure(integrated);
  if (failure) {
    if (failure.state === 'indeterminate') return failure;
    try {
      await rejectBusyCheckout(process, signal);
    } catch (error) {
      if (
        error instanceof GitActionRejectedError &&
        error.reason === 'CHECKOUT_BUSY'
      )
        return {
          state: 'conflicted',
          result: { trackingOid: candidate },
          refreshRequired: true,
        };
      throw error;
    }
    return failure;
  }
  const result = (
    await readActionCommand(process, ['rev-parse', '--verify', 'HEAD'], signal)
  ).trimEnd();
  const contains = await process.execute(
    ['merge-base', '--is-ancestor', candidate, result],
    signal,
  );
  const containsFailure = processFailure(contains);
  if (containsFailure?.state === 'indeterminate') return containsFailure;
  return contains.exitCode === 0
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
