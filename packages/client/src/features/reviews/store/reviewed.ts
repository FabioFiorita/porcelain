import type { ListReviewedFilesResponse } from '@porcelain/contracts/reviews';
import {
  Context,
  DateTime,
  Effect,
  Layer,
  Option,
  Stream,
  SubscriptionRef,
} from 'effect';
import { Atom, AsyncResult } from 'effect/reactivity';
import type { ConnectionError } from '../../../shared/api/connection-error.ts';
import type { WriteNotSentError } from '../../../shared/api/write-queue.ts';
import {
  porcelainClient,
  type PorcelainApi,
} from '../../../shared/api/client.ts';
import {
  confirmedResource,
  type ConfirmedResource,
} from '../../../shared/api/confirmed-resource.ts';
import type {
  RuntimeConnection,
  WorktreeScope,
} from '../../../shared/api/connection.ts';
import type { RequestError } from '../../../shared/api/request-error.ts';
import { queryKeys } from '../../../shared/api/query-keys.ts';
import { currentAnswerEffect } from '../../../shared/api/stale-answer.ts';
import { clientRuntime } from '../../../shared/api/runtime.ts';
import {
  applyReviewedIntents,
  reviewedSurface,
  type ReviewedChange,
  type ReviewedIntent,
  reviewedReadRange,
  type ReviewedReadRange,
} from '../rules/reviewed.ts';

type ReviewedFailure =
  | Effect.Error<ReturnType<PorcelainApi['reviews']['listReviewedFiles']>>
  | RequestError;
type ReviewedResource = ConfirmedResource<
  ListReviewedFilesResponse,
  ReviewedFailure
>;

export class ReviewedFilesState extends Context.Service<
  ReviewedFilesState,
  {
    readonly stream: ReviewedResource['stream'];
    readonly confirm: <A extends ListReviewedFilesResponse, E, R>(
      changes: readonly ReviewedChange[],
      operation: Effect.Effect<A, E, R>,
    ) => Effect.Effect<A, E | ConnectionError | WriteNotSentError, R>;
  }
>()('@porcelain/client/ReviewedFilesState') {
  static layer(
    connection: RuntimeConnection,
    scope: WorktreeScope,
    range: ReviewedReadRange,
  ) {
    return Layer.effect(
      ReviewedFilesState,
      Effect.gen(function* () {
        const client = yield* porcelainClient(connection);
        const pending = yield* SubscriptionRef.make<readonly ReviewedIntent[]>(
          [],
        );
        const surface = reviewedSurface(range);
        const state = yield* confirmedResource(
          connection,
          queryKeys.reviewSurface(connection.environmentId, scope, surface),
          Effect.gen(function* () {
            const answer = yield* client.request((api) =>
              api.reviews.listReviewedFiles({
                params: { worktreeId: scope.worktreeId },
                query:
                  range.kind === 'branch'
                    ? { scope: 'branch', branch: range.branch }
                    : {},
              }),
            );
            yield* currentAnswerEffect(
              connection.request().signal,
              answer.worktreeId === scope.worktreeId,
            );
            return answer;
          }),
          Option.none(),
          queryKeys.worktreeReads(connection, scope, surface),
        );
        return {
          stream: Stream.zipLatestWith(
            state.stream,
            SubscriptionRef.changes(pending),
            (result, intents) =>
              AsyncResult.map(result, (confirmed) =>
                applyReviewedIntents(confirmed, intents),
              ),
          ),
          confirm: <A extends ListReviewedFilesResponse, E, R>(
            changes: readonly ReviewedChange[],
            operation: Effect.Effect<A, E, R>,
          ) =>
            Effect.uninterruptibleMask((restore) =>
              Effect.gen(function* () {
                yield* restore(
                  currentAnswerEffect(connection.request().signal),
                );
                const intent = {
                  id: Symbol(),
                  changes,
                  reviewedAt: DateTime.formatIso(yield* DateTime.now),
                };
                yield* SubscriptionRef.update(pending, (current) => [
                  ...current,
                  intent,
                ]);
                return yield* restore(
                  state.confirm(
                    operation.pipe(
                      Effect.tap((answer) =>
                        currentAnswerEffect(
                          connection.request().signal,
                          answer.worktreeId === scope.worktreeId,
                        ),
                      ),
                    ),
                    (_, answer) =>
                      Option.some({
                        worktreeId: answer.worktreeId,
                        marks: answer.marks,
                      }),
                  ),
                ).pipe(
                  Effect.ensuring(
                    SubscriptionRef.update(pending, (current) =>
                      current.filter((candidate) => candidate.id !== intent.id),
                    ),
                  ),
                );
              }),
            ),
        };
      }),
    );
  }
}
const runtimes = Atom.family(
  ({
    connection,
    scope,
    range,
  }: {
    connection: RuntimeConnection;
    scope: WorktreeScope;
    range: ReviewedReadRange;
  }) =>
    connection.atoms((get) =>
      Layer.provideMerge(
        ReviewedFilesState.layer(connection, scope, range),
        get(clientRuntime(connection).layer),
      ),
    ),
);
export function reviewedRuntime(input: {
  connection: RuntimeConnection;
  scope: WorktreeScope;
  range: ReviewedReadRange;
}) {
  return runtimes({ ...input, range: reviewedReadRange(input.range) });
}
