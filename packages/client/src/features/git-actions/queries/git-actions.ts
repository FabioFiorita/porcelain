import { Atom } from 'effect/reactivity';
import type { WorktreeConnection } from '../../../shared/api/connection.ts';
import { COMMIT_MODELS_STALE_MS } from '../../../config/limits.ts';
import { gitActionsClient } from '../api.ts';

const models = Atom.family((connection: WorktreeConnection) =>
  gitActionsClient(connection)
    .query('gitActions', 'listCommitModels', {
      timeToLive: COMMIT_MODELS_STALE_MS,
    })
    .pipe(
      Atom.swr({ staleTime: COMMIT_MODELS_STALE_MS, revalidateOnFocus: false }),
    ),
);
export function readCommitModels(connection: WorktreeConnection) {
  return models(connection);
}
