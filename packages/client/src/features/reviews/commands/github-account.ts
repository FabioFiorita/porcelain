import { Effect } from 'effect';
import { Atom, Reactivity } from 'effect/reactivity';
import type { SetGitHubAccountRequest } from '@porcelain/contracts/reviews';
import type { RuntimeConnection } from '../../../shared/api/connection.ts';
import { clientRuntime } from '../../../shared/api/runtime.ts';
import { requestApi } from '../../../shared/api/client.ts';
import { queryKeys } from '../../../shared/api/query-keys.ts';
export const setProjectGitHubAccount = Atom.family(
  (input: { connection: RuntimeConnection; projectId: string }) =>
    clientRuntime(input.connection).fn(
      Effect.fn('Reviews.setGitHubAccount')(function* (
        payload: SetGitHubAccountRequest,
      ) {
        const result = yield* requestApi(input.connection, (api) =>
          api.reviews.setProjectGitHubAccount({
            params: { projectId: input.projectId },
            payload,
          }),
        );
        yield* Reactivity.invalidate([
          queryKeys.inventory(input.connection.environmentId),
          queryKeys.projectReviews(input.connection.environmentId),
        ]);
        return result;
      }),
    ),
);
