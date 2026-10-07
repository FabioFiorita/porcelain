import { Effect, Option } from 'effect';
import { Atom, Reactivity } from 'effect/reactivity';
import type {
  RuntimeConnection,
  WorktreeScope,
} from '../../../shared/api/connection.ts';
import { currentAnswerEffect } from '../../../shared/api/stale-answer.ts';
import { queryKeys } from '../../../shared/api/query-keys.ts';
import { porcelainClient } from '../../../shared/api/client.ts';
import { requestEffect } from '../../../shared/api/effect-client.ts';
import { LayerMarksState, layerMarksRuntime } from '../store/layer-marks.ts';

export const toggleLayerMark = Atom.family(
  ({
    connection,
    scope,
  }: {
    connection: RuntimeConnection;
    scope: WorktreeScope;
  }) =>
    layerMarksRuntime({ connection, scope }).fn(
      Effect.fn('Reviews.toggleLayerMark')(function* (input: {
        layerId: string;
        fingerprint: string;
        reviewed: boolean;
      }) {
        const api = yield* porcelainClient(connection);
        const marks = yield* LayerMarksState;
        const answer = yield* marks.confirm(
          Effect.gen(function* () {
            const result = yield* requestEffect(
              input.reviewed
                ? api.reviews.removeReviewedLayer({
                    params: { worktreeId: scope.worktreeId },
                    query: { layerId: input.layerId },
                  })
                : api.reviews.setReviewedLayer({
                    params: { worktreeId: scope.worktreeId },
                    payload: {
                      layerId: input.layerId,
                      fingerprint: input.fingerprint,
                      reviewed: true,
                    },
                  }),
              connection.request,
            );
            yield* currentAnswerEffect(
              connection.request().signal,
              result.worktreeId === scope.worktreeId,
            );
            return result;
          }),
          (_, result) => Option.some(result),
        );
        yield* Reactivity.invalidate([
          queryKeys.inventory(connection.environmentId),
        ]);
        return answer;
      }),
      { concurrent: true },
    ),
);
