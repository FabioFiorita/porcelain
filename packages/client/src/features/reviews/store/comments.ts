import type { ListCommentThreadsResponse } from '@porcelain/contracts/reviews';
import { Context, Effect, Layer, Option } from 'effect';
import { Atom } from 'effect/reactivity';
import { porcelainClient } from '../../../shared/api/client.ts';
import {
  confirmedResource,
  type ConfirmedResource,
} from '../../../shared/api/confirmed-resource.ts';
import type {
  RuntimeConnection,
  WorktreeScope,
} from '../../../shared/api/connection.ts';
import { requestEffect } from '../../../shared/api/effect-client.ts';
import type { RequestError } from '../../../shared/api/request-error.ts';
import { queryKeys } from '../../../shared/api/query-keys.ts';
import { currentAnswerEffect } from '../../../shared/api/stale-answer.ts';
import { clientRuntime } from '../../../shared/api/runtime.ts';

type CommentsFailure =
  | Effect.Error<
      ReturnType<
        Context.Service.Shape<
          ReturnType<typeof porcelainClient>
        >['reviews']['listCommentThreads']
      >
    >
  | RequestError;

export class CommentThreadsState extends Context.Service<
  CommentThreadsState,
  ConfirmedResource<ListCommentThreadsResponse, CommentsFailure>
>()('@porcelain/client/CommentThreadsState') {
  static layer(connection: RuntimeConnection, scope: WorktreeScope) {
    return Layer.effect(
      CommentThreadsState,
      Effect.gen(function* () {
        const api = yield* porcelainClient(connection);
        return yield* confirmedResource(
          connection,
          queryKeys.reviewSurface(connection.environmentId, scope, [
            'comments',
          ]),
          Effect.gen(function* () {
            const threads = yield* requestEffect(
              api.reviews.listCommentThreads({
                params: { worktreeId: scope.worktreeId },
              }),
            );
            yield* currentAnswerEffect(
              connection.request().signal,
              threads.every((thread) => thread.worktreeId === scope.worktreeId),
            );
            return threads;
          }),
          Option.none(),
          queryKeys.worktreeReads(connection, scope, ['comments']),
        );
      }),
    );
  }
}

export const commentsRuntime = Atom.family(
  ({
    connection,
    scope,
  }: {
    connection: RuntimeConnection;
    scope: WorktreeScope;
  }) =>
    connection.atoms((get) =>
      Layer.provideMerge(
        CommentThreadsState.layer(connection, scope),
        get(clientRuntime(connection).layer),
      ),
    ),
);
