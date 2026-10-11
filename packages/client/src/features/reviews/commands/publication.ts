import { Effect } from 'effect';
import { Atom, Reactivity } from 'effect/reactivity';
import type {
  RuntimeConnection,
  WorktreeScope,
} from '../../../shared/api/connection.ts';
import { requestApi } from '../../../shared/api/client.ts';
import { clientRuntime } from '../../../shared/api/runtime.ts';
import { queryKeys } from '../../../shared/api/query-keys.ts';

export const deleteReview = Atom.family(
  ({
    connection,
    scope,
  }: {
    connection: RuntimeConnection;
    scope: WorktreeScope;
  }) =>
    clientRuntime(connection).fn(
      Effect.fn('Reviews.deleteReview')(function* () {
        const answer = yield* requestApi(connection, (api) =>
          api.reviews.deleteReview({
            params: { worktreeId: scope.worktreeId },
          }),
        );
        yield* Reactivity.invalidate([
          queryKeys.reviewSurface(connection.environmentId, scope, ['review']),
          queryKeys.reviewSurface(connection.environmentId, scope, [
            'reviewed-layers',
          ]),
          queryKeys.inventory(connection.environmentId),
        ]);
        return answer;
      }),
    ),
);
