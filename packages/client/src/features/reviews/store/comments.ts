import type { ListCommentThreadsResponse } from '@porcelain/contracts/reviews';
import { Context, Effect, Layer, Option } from 'effect';
import { Atom } from 'effect/reactivity';
import {
  porcelainClient,
  type PorcelainApi,
} from '../../../shared/api/client.ts';
import {
  confirmedResource,
  type ConfirmedRequest,
} from '../../../shared/api/confirmed-resource.ts';
import type {
  RuntimeConnection,
  WorktreeScope,
} from '../../../shared/api/connection.ts';
import { queryKeys } from '../../../shared/api/query-keys.ts';
import { currentAnswerEffect } from '../../../shared/api/stale-answer.ts';
import { clientRuntime } from '../../../shared/api/runtime.ts';

type CommentsFailure = Effect.Error<
  ReturnType<PorcelainApi['reviews']['listCommentThreads']>
>;

export class CommentThreadsState extends Context.Service<
  CommentThreadsState,
  ConfirmedRequest<ListCommentThreadsResponse, CommentsFailure>
>()('@porcelain/client/CommentThreadsState') {
  static layer(connection: RuntimeConnection, scope: WorktreeScope) {
    return Layer.effect(
      CommentThreadsState,
      Effect.gen(function* () {
        const client = yield* porcelainClient(connection);
        return yield* confirmedResource(
          connection,
          queryKeys.reviewSurface(connection.environmentId, scope, [
            'comments',
          ]),
          Effect.gen(function* () {
            const threads = yield* client.request((api) =>
              api.reviews.listCommentThreads({
                params: { worktreeId: scope.worktreeId },
              }),
            );
            yield* currentAnswerEffect(
              connection,
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
