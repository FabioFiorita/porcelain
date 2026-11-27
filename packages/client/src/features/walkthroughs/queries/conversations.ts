import { Effect, Option } from 'effect';
import { AsyncResult, Atom } from 'effect/reactivity';
import type { WorktreeSelection } from '../../../shared/api/connection.ts';
import { requestApi } from '../../../shared/api/client.ts';
import { clientRuntime } from '../../../shared/api/runtime.ts';
import { retainRead, worktreeRead } from '../../../shared/api/worktree-read.ts';

import {
  undecidedCallStep,
  undecidedCallCount,
  type WalkthroughContent,
} from '../rules/walkthrough.ts';
import { callsNeedingCommit } from '../rules/page.ts';

const readConversationsSnapshot = Effect.fn('Walkthroughs.readConversations')(
  function* ({
    connection,
    scope,
    runId,
  }: WorktreeSelection & { runId: string }) {
    return yield* requestApi(connection, (api) =>
      api.walkthroughs.listWalkthroughConversations({
        params: { worktreeId: scope.worktreeId, runId },
      }),
    );
  },
);

export const readWalkthroughConversations = Atom.family(
  (selection: WorktreeSelection & { runId: string }) =>
    worktreeRead(
      selection.connection,
      selection.scope,
      ['walkthrough-conversations', selection.runId],
      readConversationsSnapshot(selection),
      clientRuntime(selection.connection),
    ).pipe(retainRead),
);

type MergeReviewSelection = WorktreeSelection & {
  runId: string;
  headOid: string;
  content: WalkthroughContent;
};

export const readWalkthroughMergeReview = Atom.family(
  (selection: MergeReviewSelection | undefined) =>
    Atom.make((get) => {
      if (!selection) return undefined;
      const result = get(
        readWalkthroughConversations({
          connection: selection.connection,
          scope: {
            projectId: selection.scope.projectId,
            worktreeId: selection.scope.worktreeId,
          },
          runId: selection.runId,
        }),
      );
      const view = Option.getOrUndefined(AsyncResult.value(result));
      return {
        headOid: selection.headOid,
        undecidedCallStep: undecidedCallStep(
          selection.content,
          view?.decisions,
          AsyncResult.isFailure(result),
        ),
        undecidedCalls: undecidedCallCount(selection.content, view?.decisions),
        callsNeedingCommit: callsNeedingCommit(
          selection.content,
          view?.decisions,
        ),
      };
    }),
);
