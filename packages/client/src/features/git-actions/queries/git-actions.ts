import { Atom } from 'effect/reactivity';
import type { RuntimeConnection } from '../../../shared/api/connection.ts';
import { COMMIT_MODELS_STALE_MS } from '../../../config/limits.ts';
import { requestApi } from '../../../shared/api/client.ts';
import { clientRuntime } from '../../../shared/api/runtime.ts';

const models = Atom.family((connection: RuntimeConnection) =>
  clientRuntime(connection)
    .atom(requestApi(connection, (api) => api.gitActions.listCommitModels()))
    .pipe(
      Atom.setIdleTTL(COMMIT_MODELS_STALE_MS),
      Atom.swr({ staleTime: COMMIT_MODELS_STALE_MS, revalidateOnFocus: false }),
    ),
);
export function readCommitModels(connection: RuntimeConnection) {
  return models(connection);
}
