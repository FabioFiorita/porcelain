import { Effect } from 'effect';
import type { EffectCheckoutSession } from '../inspection/index.ts';
import type { GitLimits } from '../shared/dtos/git-limits.ts';
import { type GitProcessResult, gitWrite } from '../shared/commands/run-git.ts';
import { applyStash } from './commands/apply-stash.ts';
import { commitIndex } from './commands/commit-index.ts';
import { createStash } from './commands/create-stash.ts';
import { discardPath } from './commands/discard-path.ts';
import { fetchBranch } from './commands/fetch-branch.ts';
import { inspectActionTarget } from './commands/inspect-action-target.ts';
import { pullBranch } from './commands/pull-branch.ts';
import { pushBranch } from './commands/push-branch.ts';
import type {
  GitActionExpectation,
  GitActionIntent,
  GitActionOutcome,
} from './dtos/git-action.ts';
import { GitActionRejectedError } from '../shared/errors/git-action-rejected-error.ts';
const UNAVAILABLE: GitActionOutcome = {
  state: 'rejected',
  reason: 'GIT_REJECTED',
  refreshRequired: false,
};

export const executeGitAction = Effect.fn('Git.executeAction')(function* (
  session: EffectCheckoutSession,
  limits: GitLimits,
  requestId: string,
  intent: GitActionIntent,
  expected: GitActionExpectation,
  onProgress?: (line: string) => void,
) {
  let unconfirmed = false;
  let progress: ((line: string) => void) | undefined;
  const process = {
    limits,
    execute: Effect.fn('Git.actionCommand')(function* (
      args: readonly string[],
      input?: string,
      options?: { indexFile?: string },
    ) {
      if (unconfirmed)
        return yield* new GitActionRejectedError({
          reason: 'PROCESS_GROUP_UNCONFIRMED',
        });
      const result: GitProcessResult = yield* gitWrite(
        session.path,
        args,
        limits,
        {
          ...(input === undefined ? {} : { input }),
          ...(options?.indexFile === undefined
            ? {}
            : { indexFile: options.indexFile }),
          ...(progress === undefined ? {} : { onProgress: progress }),
        },
      );
      if (!result.descendantsStopped) {
        unconfirmed = true;
        return yield* new GitActionRejectedError({
          reason: 'PROCESS_GROUP_UNCONFIRMED',
        });
      }
      return result;
    }),
  };
  yield* session.verify();
  const { preview, remote, stashLog } = yield* inspectActionTarget(
    process,
    intent,
    expected,
  );
  yield* session.confirm();
  const id = requestId;
  progress =
    intent.action === 'fetch' ||
    intent.action === 'pull' ||
    intent.action === 'push'
      ? onProgress
      : undefined;
  switch (intent.action) {
    case 'commit':
    case 'amend':
      return yield* commitIndex(process, { id, intent, preview });
    case 'fetch':
      return remote
        ? yield* fetchBranch(process, { id, intent, preview }, remote)
        : UNAVAILABLE;
    case 'pull':
      return remote
        ? yield* pullBranch(process, { id, intent, preview }, remote)
        : UNAVAILABLE;
    case 'push':
      return remote && preview.headOid
        ? yield* pushBranch(
            process,
            { id, intent, preview },
            remote,
            preview.headOid,
          )
        : UNAVAILABLE;
    case 'stash-create':
      return yield* createStash(process, { id, intent, preview });
    case 'stash-apply':
    case 'stash-pop':
      return yield* applyStash(process, { id, intent, preview }, stashLog);
    case 'discard':
      return yield* discardPath(process, { id, intent, preview });
  }
});
