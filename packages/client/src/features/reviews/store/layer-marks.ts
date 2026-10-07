import type { ListReviewedLayersResponse } from '@porcelain/contracts/reviews';
import { Context, Effect, Layer, Option } from 'effect';
import { Atom } from 'effect/reactivity';
import {
  confirmedResource,
  type ConfirmedResource,
} from '../../../shared/api/confirmed-resource.ts';
import { porcelainClient } from '../../../shared/api/client.ts';
import type {
  RuntimeConnection,
  WorktreeScope,
} from '../../../shared/api/connection.ts';
import type { RequestError } from '../../../shared/api/request-error.ts';
import { requestEffect } from '../../../shared/api/effect-client.ts';
import { currentAnswerEffect } from '../../../shared/api/stale-answer.ts';
import { queryKeys } from '../../../shared/api/query-keys.ts';
import { clientRuntime } from '../../../shared/api/runtime.ts';

type LayerMarksFailure =
  | Effect.Error<
      ReturnType<
        Context.Service.Shape<
          ReturnType<typeof porcelainClient>
        >['reviews']['listReviewedLayers']
      >
    >
  | RequestError;

export class LayerMarksState extends Context.Service<
  LayerMarksState,
  ConfirmedResource<ListReviewedLayersResponse, LayerMarksFailure>
>()('@porcelain/client/LayerMarksState') {
  static layer(connection: RuntimeConnection, scope: WorktreeScope) {
    return Layer.effect(
      LayerMarksState,
      Effect.gen(function* () {
        const api = yield* porcelainClient(connection);
        return yield* confirmedResource(
          connection,
          queryKeys.reviewSurface(connection.environmentId, scope, [
            'reviewed-layers',
          ]),
          Effect.gen(function* () {
            const answer = yield* requestEffect(
              api.reviews.listReviewedLayers({
                params: { worktreeId: scope.worktreeId },
              }),
              connection.request,
            );
            yield* currentAnswerEffect(
              connection.request().signal,
              answer.worktreeId === scope.worktreeId,
            );
            return answer;
          }),
          Option.none(),
          queryKeys.worktreeReads(connection, scope, ['reviewed-layers']),
        );
      }),
    );
  }
}

export const layerMarksRuntime = Atom.family(
  ({
    connection,
    scope,
  }: {
    connection: RuntimeConnection;
    scope: WorktreeScope;
  }) =>
    connection.atoms((get) =>
      Layer.provideMerge(
        LayerMarksState.layer(connection, scope),
        get(clientRuntime(connection).layer),
      ),
    ),
);
