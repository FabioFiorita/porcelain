import type {
  GitActionExpectation,
  GitActionIntent,
} from '../dtos/git-action.ts';
import type { GitActionSnapshot } from '../dtos/git-action-snapshot.ts';
import { GitActionRejectedError } from '../errors/git-action-rejected-error.ts';
import { readOptionalActionOid } from '../helpers/read-optional-action-oid.ts';
import { rejectBusyCheckout } from '../helpers/reject-busy-checkout.ts';
import type { GitProcessRunner } from '../interfaces/git-process-runner.ts';
import { processFailure } from './action-outcome.ts';
import { checkStashCollisions } from './check-stash-collisions.ts';
import { inspectActionConfig } from './inspect-action-config.ts';
import { inspectActionRemote } from './inspect-action-remote.ts';
import { readActionCommand } from './read-action-command.ts';

export async function inspectActionTarget(
  process: GitProcessRunner,
  intent: GitActionIntent,
  expected: GitActionExpectation,
  signal: AbortSignal,
): Promise<GitActionSnapshot> {
  const inProgress = await rejectBusyCheckout(
    process,
    signal,
    intent.action === 'commit',
  );
  if (inProgress !== expected.inProgress)
    throw new GitActionRejectedError('CHANGED_SINCE_LOOKED');
  const mergeHeadOid =
    inProgress === 'merge'
      ? await readOptionalActionOid(process, 'MERGE_HEAD', signal)
      : null;
  if (mergeHeadOid !== expected.mergeHeadOid)
    throw new GitActionRejectedError('CHANGED_SINCE_LOOKED');
  await inspectActionConfig(process, signal);
  const headOid = await readOptionalActionOid(process, 'HEAD', signal);
  const branchResult = await process.execute(
    ['symbolic-ref', '--quiet', 'HEAD'],
    signal,
  );
  const branchFailure = processFailure(branchResult);
  if (branchFailure?.state === 'indeterminate')
    throw new GitActionRejectedError(branchFailure.reason ?? 'GIT_REJECTED');
  const branchRef =
    branchResult.exitCode === 0
      ? branchResult.stdout.toString('utf8').trimEnd()
      : null;
  const displayedBranch = branchRef?.startsWith('refs/heads/')
    ? branchRef.slice('refs/heads/'.length)
    : branchRef;
  if (headOid !== expected.headOid || displayedBranch !== expected.branch)
    throw new GitActionRejectedError('CHANGED_SINCE_LOOKED');

  const network =
    intent.action === 'fetch' ||
    intent.action === 'pull' ||
    intent.action === 'push';
  const remote = network
    ? await inspectActionRemote(process, intent, signal)
    : undefined;
  const trackingOid = remote
    ? await readOptionalActionOid(process, remote.trackingRef, signal)
    : null;
  if (network && trackingOid !== expected.upstreamOid)
    throw new GitActionRejectedError('CHANGED_SINCE_LOOKED');

  const needsChanges =
    intent.action === 'pull' ||
    intent.action === 'stash-create' ||
    intent.action === 'stash-apply' ||
    intent.action === 'stash-pop';
  const status = needsChanges
    ? await readActionCommand(
        process,
        ['status', '--porcelain=v1', '-z', '--untracked-files=all'],
        signal,
      )
    : '';
  if (intent.action === 'pull' && status)
    throw new GitActionRejectedError('CHECKOUT_BUSY');
  const records = status.split('\0').filter(Boolean);
  const trackedChanges = records.some((entry) => !entry.startsWith('?? '));
  const untrackedCount = records.filter((entry) =>
    entry.startsWith('?? '),
  ).length;
  const stashLog =
    intent.action === 'stash-apply' || intent.action === 'stash-pop'
      ? await readActionCommand(
          process,
          ['stash', 'list', '--format=%H%x00%gd%x00%gs'],
          signal,
        )
      : '';
  if (intent.action === 'stash-apply' || intent.action === 'stash-pop') {
    const objectType = await readActionCommand(
      process,
      ['cat-file', '-t', intent.stashOid],
      signal,
    );
    if (objectType.trimEnd() !== 'blob')
      await checkStashCollisions(process, intent.stashOid, signal);
  }
  return {
    fingerprint: '',
    stashLog,
    ...(remote ? { remote } : {}),
    preview: {
      headOid,
      branch: branchRef,
      staged: false,
      trackedChanges,
      untrackedCount,
      inProgress,
      mergeHeadOid,
      ...(remote ? { destination: remote.display, trackingOid } : {}),
      ...('stashOid' in intent ? { stashOid: intent.stashOid } : {}),
    },
  };
}
