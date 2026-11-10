import { Effect } from 'effect';
import { Atom, Reactivity } from 'effect/reactivity';
import type { StartWalkthroughRequest } from '@porcelain/contracts/walkthroughs';
import type { WorktreeSelection } from '../../../shared/api/connection.ts';
import { requestApi } from '../../../shared/api/client.ts';
import { queryKeys } from '../../../shared/api/query-keys.ts';
import { clientRuntime } from '../../../shared/api/runtime.ts';

export const startWalkthrough = Atom.family((selection: WorktreeSelection) =>
  clientRuntime(selection.connection).fn(
    Effect.fn('Walkthroughs.start')(function* (
      payload: StartWalkthroughRequest,
    ) {
      const run = yield* requestApi(selection.connection, (api) =>
        api.walkthroughs.startWalkthrough({
          params: { worktreeId: selection.scope.worktreeId },
          payload,
        }),
      );
      yield* Reactivity.invalidate([
        queryKeys.reviewSurface(
          selection.connection.environmentId,
          selection.scope,
          ['walkthrough'],
        ),
      ]);
      return run;
    }),
  ),
);
