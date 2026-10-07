import { Effect } from 'effect';
import type { ActionFailure, ActionPlatform } from '../dtos/action-failure.ts';
import { shortBranchName } from '../../shared/parsers/refs.ts';
import type {
  GitActionExpectation,
  GitActionIntent,
} from '../dtos/git-action.ts';
import type { GitActionSnapshot } from '../dtos/git-action-snapshot.ts';
import { GitActionRejectedError } from '../../shared/errors/git-action-rejected-error.ts';
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

export const inspectActionTarget = Effect.fn('Git.inspectActionTarget')(
  function* (
    process: GitProcessRunner,
    intent: GitActionIntent,
    expected: GitActionExpectation,
  ): Effect.fn.Return<GitActionSnapshot, ActionFailure, ActionPlatform> {
    const inProgress = yield* rejectBusyCheckout(
      process,
      intent.action === 'commit',
    );
    if (inProgress !== expected.inProgress)
      return yield* new GitActionRejectedError({
        reason: 'CHANGED_SINCE_LOOKED',
      });
    const mergeHeadOid =
      inProgress === 'merge'
        ? yield* readOptionalActionOid(process, 'MERGE_HEAD')
        : null;
    if (mergeHeadOid !== expected.mergeHeadOid)
      return yield* new GitActionRejectedError({
        reason: 'CHANGED_SINCE_LOOKED',
      });
    yield* inspectActionConfig(process, intent.action);
    const headOid = yield* readOptionalActionOid(process, 'HEAD');
    const branch = yield* readActionBranch(process);
    if (
      headOid !== expected.headOid ||
      (branch === null ? null : shortBranchName(branch)) !== expected.branch
    )
      return yield* new GitActionRejectedError({
        reason: 'CHANGED_SINCE_LOOKED',
      });

    const remote =
      intent.action === 'fetch' ||
      intent.action === 'pull' ||
      intent.action === 'push'
        ? yield* inspectActionRemote(process, intent)
        : undefined;
    const trackingOid = remote
      ? yield* readOptionalActionOid(process, remote.trackingRef)
      : null;
    if (remote && trackingOid !== expected.upstreamOid)
      return yield* new GitActionRejectedError({
        reason: 'CHANGED_SINCE_LOOKED',
      });

    const stash =
      intent.action === 'stash-apply' || intent.action === 'stash-pop';
    const changes =
      intent.action === 'pull' || intent.action === 'stash-create' || stash
        ? yield* readActionStatus(process)
        : [];
    if (intent.action === 'pull' && changes.length > 0)
      return yield* new GitActionRejectedError({ reason: 'CHECKOUT_BUSY' });
    const stashLog = stash ? yield* readStashLog(process) : '';
    if (stash) {
      const objectType = yield* readActionCommand(process, [
        'cat-file',
        '-t',
        intent.stashOid,
      ]);
      if (objectType.trimEnd() !== 'blob')
        yield* checkStashCollisions(process, intent.stashOid);
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
  },
);
