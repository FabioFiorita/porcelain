import { Effect } from 'effect';
import type {
  WorktreeConnection,
  WorktreeScope,
} from '../../../shared/api/connection.ts';
import { requestEffect } from '../../../shared/api/effect-client.ts';
import { currentAnswerEffect } from '../../../shared/api/stale-answer.ts';
import { filesApi } from '../api.ts';

export function readPreviewAssets(
  connection: WorktreeConnection,
  scope: WorktreeScope,
  document: string,
  paths: readonly string[],
) {
  const connected = connection.request();
  return requestEffect(
    filesApi(connection).readPreviewAssets({
      params: { worktreeId: scope.worktreeId },
      payload: { document, paths },
    }),
    connected.signal,
  ).pipe(
    Effect.tap(() => currentAnswerEffect(connected.signal)),
    Effect.map(
      (response) =>
        new Map(
          response.assets.map((asset) => [
            asset.path,
            asset.kind === 'asset' ? asset : null,
          ]),
        ),
    ),
  );
}
