import { Effect } from 'effect';
import { Atom } from 'effect/reactivity';
import type { WorktreeSelection } from '../../../shared/api/connection.ts';
import { requestApi } from '../../../shared/api/client.ts';
import { clientRuntime } from '../../../shared/api/runtime.ts';
import { retainRead, worktreeRead } from '../../../shared/api/worktree-read.ts';

const readConversationsSnapshot = Effect.fn('Walkthroughs.readConversations')(
  function* ({ connection, scope }: WorktreeSelection) {
    return yield* requestApi(connection, (api) =>
      api.walkthroughs.listWalkthroughConversations({
        params: { worktreeId: scope.worktreeId },
      }),
    );
  },
);

export const readWalkthroughConversations = Atom.family(
  (selection: WorktreeSelection) =>
    worktreeRead(
      selection.connection,
      selection.scope,
      ['walkthrough-conversations'],
      readConversationsSnapshot(selection),
      clientRuntime(selection.connection),
    ).pipe(retainRead),
);
