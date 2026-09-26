import { shortBranchName } from '../../shared/parsers/refs.ts';
import type {
  GitActionExpectation,
  GitActionIntent,
} from '../dtos/git-action.ts';
import type { GitActionSnapshot } from '../dtos/git-action-snapshot.ts';
import { GitActionRejectedError } from '../errors/git-action-rejected-error.ts';
import type { GitProcessRunner } from '../interfaces/git-process-runner.ts';
import { checkStashCollisions } from './check-stash-collisions.ts';
import { inspectActionConfig } from './inspect-action-config.ts';
import { inspectActionRemote } from './inspect-action-remote.ts';
import { readActionBranch } from './read-action-branch.ts';
import { readActionCommand } from './read-action-command.ts';
import { readActionStatus } from './read-action-status.ts';
import { readOptionalActionOid } from './read-optional-action-oid.ts';
import { readStashLog } from './read-stash-log.ts';
import { rejectBusyCheckout } from './reject-busy-checkout.ts';

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
  await inspectActionConfig(process, signal, intent.action);
  const headOid = await readOptionalActionOid(process, 'HEAD', signal);
  const branch = await readActionBranch(process, signal);
  if (
    headOid !== expected.headOid ||
    (branch === null ? null : shortBranchName(branch)) !== expected.branch
  )
    throw new GitActionRejectedError('CHANGED_SINCE_LOOKED');

  const remote =
    intent.action === 'fetch' ||
    intent.action === 'pull' ||
    intent.action === 'push'
      ? await inspectActionRemote(process, intent, signal)
      : undefined;
  const trackingOid = remote
    ? await readOptionalActionOid(process, remote.trackingRef, signal)
    : null;
  if (remote && trackingOid !== expected.upstreamOid)
    throw new GitActionRejectedError('CHANGED_SINCE_LOOKED');

  const stash =
    intent.action === 'stash-apply' || intent.action === 'stash-pop';
  const changes =
    intent.action === 'pull' || intent.action === 'stash-create' || stash
      ? await readActionStatus(process, signal)
      : [];
  if (intent.action === 'pull' && changes.length > 0)
    throw new GitActionRejectedError('CHECKOUT_BUSY');
  const stashLog = stash ? await readStashLog(process, signal) : '';
  if (stash) {
    const objectType = await readActionCommand(
      process,
      ['cat-file', '-t', intent.stashOid],
      signal,
    );
    if (objectType.trimEnd() !== 'blob')
      await checkStashCollisions(process, intent.stashOid, signal);
  }
  return {
    stashLog,
    ...(remote ? { remote } : {}),
    preview: {
      headOid,
      branch,
      staged: false,
      trackedChanges: changes.some((change) => change.scope !== 'untracked'),
      untrackedCount: changes.filter((change) => change.scope === 'untracked')
        .length,
      inProgress,
      mergeHeadOid,
      ...(remote ? { destination: remote.display, trackingOid } : {}),
      ...('stashOid' in intent ? { stashOid: intent.stashOid } : {}),
    },
  };
}
