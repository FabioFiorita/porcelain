import { Effect } from 'effect';
import { requestEffect } from '../../../shared/api/effect-client.ts';
import { Atom } from 'effect/reactivity';
import type { RuntimeConnection } from '../../../shared/api/connection.ts';
import { COMMIT_MODELS_STALE_MS } from '../../../config/limits.ts';
import { porcelainClient } from '../../../shared/api/client.ts';
import { clientRuntime } from '../../../shared/api/runtime.ts';

const models = Atom.family((connection: RuntimeConnection) =>
  clientRuntime(connection)
    .atom(
      Effect.gen(function* () {
        const api = yield* porcelainClient(connection);
        return yield* requestEffect(
          api.gitActions.listCommitModels(),
          connection.request,
        );
      }),
    )
    .pipe(
      Atom.setIdleTTL(COMMIT_MODELS_STALE_MS),
      Atom.swr({ staleTime: COMMIT_MODELS_STALE_MS, revalidateOnFocus: false }),
    ),
);
export function readCommitModels(connection: RuntimeConnection) {
  return models(connection);
}
