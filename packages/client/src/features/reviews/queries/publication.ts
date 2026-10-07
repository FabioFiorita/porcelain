import { Duration, Effect } from 'effect';
import { PUBLISHED_REVIEW_REFRESH_MS } from '../../../config/limits.ts';
import { Atom } from 'effect/reactivity';
import type {
  RuntimeConnection,
  WorktreeScope,
} from '../../../shared/api/connection.ts';
import { porcelainClient } from '../../../shared/api/client.ts';
import { clientRuntime } from '../../../shared/api/runtime.ts';
import { worktreeRead } from '../../../shared/api/worktree-read.ts';
import { currentAnswerEffect } from '../../../shared/api/stale-answer.ts';
import { worktreeResource } from '../../../shared/api/worktree-read.ts';
import { LayerMarksState, layerMarksRuntime } from '../store/layer-marks.ts';

export const readPublishedReview = Atom.family(
  ({
    connection,
    scope,
  }: {
    connection: RuntimeConnection;
    scope: WorktreeScope;
  }) =>
    worktreeRead(
      connection,
      scope,
      ['review'],
      Effect.gen(function* () {
        const client = yield* porcelainClient(connection);
        const { review } = yield* client.request((api) =>
          api.reviews.readPublishedReview({
            params: { worktreeId: scope.worktreeId },
          }),
        );
        const result = review ?? null;
        yield* currentAnswerEffect(
          connection.request().signal,
          result === null ||
            (result.environmentId === connection.environmentId &&
              result.worktreeId === scope.worktreeId),
        );
        return result;
      }),
      clientRuntime(connection),
    ).pipe(
      Atom.withRefresh(Duration.millis(PUBLISHED_REVIEW_REFRESH_MS)),
      Atom.setIdleTTL(0),
    ),
);

export const readProofFile = Atom.family(
  ({
    connection,
    scope,
    proofId,
  }: {
    connection: RuntimeConnection;
    scope: WorktreeScope;
    proofId: string;
  }) =>
    worktreeRead(
      connection,
      scope,
      ['proof', proofId],
      Effect.gen(function* () {
        const client = yield* porcelainClient(connection);
        const file = yield* client.request((api) =>
          api.reviews.readProofFile({
            params: { worktreeId: scope.worktreeId },
            query: { proofId },
          }),
        );
        yield* currentAnswerEffect(
          connection.request().signal,
          file.id === proofId,
        );
        return file;
      }),
      clientRuntime(connection),
    ),
);

export const readLayerMarks = Atom.family(
  (input: { connection: RuntimeConnection; scope: WorktreeScope }) =>
    worktreeResource(
      input.scope,
      'reviewed-layers',
      LayerMarksState,
      layerMarksRuntime(input),
    ),
);
