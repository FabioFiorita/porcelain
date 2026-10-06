import { Atom } from 'effect/reactivity';
import type { RuntimeConnection } from '../../../shared/api/connection.ts';
import { COMMIT_MODELS_STALE_MS } from '../../../config/limits.ts';
import { porcelainClient } from '../../../shared/api/client.ts';

const models = Atom.family((connection: RuntimeConnection) =>
  porcelainClient(connection)
    .query('gitActions', 'listCommitModels', {
      timeToLive: COMMIT_MODELS_STALE_MS,
    })
    .pipe(
      Atom.swr({ staleTime: COMMIT_MODELS_STALE_MS, revalidateOnFocus: false }),
    ),
);
export function readCommitModels(connection: RuntimeConnection) {
  return models(connection);
}
