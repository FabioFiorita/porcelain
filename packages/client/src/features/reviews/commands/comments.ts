import { readCommentThreads } from '../queries/comments.ts';
import type {
  CreateCommentThreadRequest,
  ReplyToCommentRequest,
  UpdateCommentThreadRequest,
  EditCommentMessageRequest,
  DeleteCommentMessageQuery,
} from '@porcelain/contracts/reviews';
import { Effect, Option } from 'effect';
import { Atom, AsyncResult, Reactivity } from 'effect/reactivity';
import type {
  RuntimeConnection,
  WorktreeScope,
} from '../../../shared/api/connection.ts';
import { porcelainClient, requestApi } from '../../../shared/api/client.ts';
import { currentAnswerEffect } from '../../../shared/api/stale-answer.ts';
import { queryKeys } from '../../../shared/api/query-keys.ts';
import {
  CommentThreadsState,
  commentsRuntime,
  commentVisibilityState,
} from '../store/comments.ts';
import {
  mergeCommentThreads,
  commentsSeenThrough,
  type CommentThread,
  type ConfirmedThreads,
} from '../rules/comments.ts';

type ReplyCommentInput = { threadId: string } & ReplyToCommentRequest;
type ResolveCommentInput = { threadId: string } & UpdateCommentThreadRequest;
type EditCommentInput = { threadId: string } & EditCommentMessageRequest;
type DeleteCommentInput = {
  threadId: string;
} & DeleteCommentMessageQuery;

const commandSets = Atom.family(
  ({
    connection,
    scope,
  }: {
    connection: RuntimeConnection;
    scope: WorktreeScope;
    owner?: string | undefined;
  }) => {
    const runtime = commentsRuntime({ connection, scope });
    const params = { worktreeId: scope.worktreeId };
    const inventory = Reactivity.invalidate([
      queryKeys.inventory(connection.environmentId),
    ]);
    function confirmThread<E>(
      operation: Effect.Effect<CommentThread, E>,
      refreshInventory = false,
    ) {
      return Effect.gen(function* () {
        const state = yield* CommentThreadsState;
        const thread = yield* state.confirm(
          operation.pipe(
            Effect.tap((thread) =>
              currentAnswerEffect(
                connection,
                thread.worktreeId === scope.worktreeId,
              ),
            ),
          ),
          (previous, thread) =>
            Option.some(
              mergeCommentThreads(
                Option.getOrElse(previous, () => []),
                [thread],
              ),
            ),
        );
        if (refreshInventory) yield* inventory;
        return thread;
      });
    }

    function confirmUpdate<A, E, R>(
      operation: Effect.Effect<A, E, R>,
      update: (
        previous: Option.Option<readonly CommentThread[]>,
        answer: A,
      ) => Option.Option<readonly CommentThread[]>,
    ) {
      return Effect.gen(function* () {
        const state = yield* CommentThreadsState;
        const result = yield* state.confirm(operation, update);
        yield* inventory;
        return result;
      });
    }
    return {
      create: runtime.fn(
        Effect.fn('Reviews.createComment')(function* (
          input: CreateCommentThreadRequest,
        ) {
          const client = yield* porcelainClient(connection);
          return yield* confirmThread(
            client.request((api) =>
              api.reviews.createCommentThread({ params, payload: input }),
            ),
          );
        }),
        { concurrent: true },
      ),
      reply: runtime.fn(
        Effect.fn('Reviews.replyToComment')(function* ({
          threadId,
          ...payload
        }: ReplyCommentInput) {
          const client = yield* porcelainClient(connection);
          return yield* confirmThread(
            client.request((api) =>
              api.reviews.replyToComment({
                params: { ...params, threadId },
                payload,
              }),
            ),
            true,
          );
        }),
        { concurrent: true },
      ),
      resolve: runtime.fn(
        Effect.fn('Reviews.resolveComment')(function* ({
          threadId,
          ...payload
        }: ResolveCommentInput) {
          const client = yield* porcelainClient(connection);
          return yield* confirmThread(
            client.request((api) =>
              api.reviews.updateCommentThread({
                params: { ...params, threadId },
                payload,
              }),
            ),
          );
        }),
        { concurrent: true },
      ),
      edit: runtime.fn(
        Effect.fn('Reviews.editComment')(function* ({
          threadId,
          ...payload
        }: EditCommentInput) {
          const client = yield* porcelainClient(connection);
          return yield* confirmThread(
            client.request((api) =>
              api.reviews.editCommentMessage({
                params: { ...params, threadId },
                payload,
              }),
            ),
          );
        }),
        { concurrent: true },
      ),
      remove: runtime.fn(
        Effect.fn('Reviews.deleteComment')(function* ({
          threadId,
          ...query
        }: DeleteCommentInput) {
          return yield* confirmUpdate(
            Effect.gen(function* () {
              const answer = yield* requestApi(connection, (api) =>
                api.reviews.deleteCommentMessage({
                  params: { ...params, threadId },
                  query,
                }),
              );
              yield* currentAnswerEffect(
                connection,
                answer.threadId === threadId &&
                  (!answer.thread ||
                    answer.thread.worktreeId === scope.worktreeId),
              );
              return answer;
            }),
            (previous, answer) =>
              Option.some(
                mergeCommentThreads(
                  Option.getOrElse(previous, () => []),
                  answer.thread ? [answer.thread] : [],
                  answer.thread ? [] : [answer.threadId],
                ),
              ),
          );
        }),
        { concurrent: true },
      ),
      removeResolved: runtime.fn(
        Effect.fn('Reviews.deleteResolvedComments')(function* (
          threads: ConfirmedThreads,
        ) {
          return yield* confirmUpdate(
            requestApi(connection, (api) =>
              api.reviews.deleteResolvedComments({
                params,
                payload: { threads },
              }),
            ),
            (previous, answer) =>
              Option.some(
                mergeCommentThreads(
                  Option.getOrElse(previous, () => []),
                  [],
                  answer.deleted,
                ),
              ),
          );
        }),
        { concurrent: true },
      ),
      seen: runtime.fn(
        Effect.fn('Reviews.markCommentsSeen')(function* (
          throughRevision: number,
        ) {
          return yield* confirmUpdate(
            Effect.gen(function* () {
              const answer = yield* requestApi(connection, (api) =>
                api.reviews.markCommentsSeen({
                  params,
                  payload: { throughRevision },
                }),
              );
              yield* currentAnswerEffect(
                connection,
                answer.worktreeId === scope.worktreeId,
              );
              return answer;
            }),
            (previous) => previous,
          );
        }),
        { concurrent: true },
      ),
    };
  },
);

export function commentCommands(
  input: { connection: RuntimeConnection; scope: WorktreeScope },
  owner?: string,
) {
  return commandSets({ ...input, owner });
}

export const observeCommentVisibility = Atom.family(
  (input: {
    connection: RuntimeConnection;
    scope: WorktreeScope;
    owner: string;
    filter: 'open' | 'resolved' | 'all' | undefined;
  }) =>
    Atom.make((get) => {
      const { filter, ...owner } = input;
      if (!filter) return;
      const history = commentVisibilityState(owner);
      const seen = commentCommands(input, input.owner).seen;
      get.mount(history);
      get.mount(seen);
      get.subscribe(
        readCommentThreads(input),
        (result) => {
          if (!AsyncResult.isSuccess(result)) return;
          const threads = result.value;
          const snapshot = threads
            .map((thread) => `${thread.id}:${thread.revision}`)
            .sort()
            .join('\n');
          const current = get.registry.get(history);
          const filters = new Set(
            current.snapshot === snapshot ? current.filters : [],
          );
          filters.add(filter);
          const highest = threads.reduce(
            (top, thread) => Math.max(top, thread.revision),
            0,
          );
          const open = threads.filter((thread) => !thread.resolved).length;
          const through =
            filter === 'all'
              ? highest
              : commentsSeenThrough(
                  { highest, open, resolved: threads.length - open },
                  filters,
                );
          get.registry.set(history, {
            snapshot,
            filters,
            through: Math.max(current.through, through ?? 0),
          });
          if (through !== null && through > current.through)
            get.registry.set(seen, through);
        },
        { immediate: true },
      );
    }),
);
