import { Duration, Effect, Option } from 'effect';
import { PUBLISHED_REVIEW_REFRESH_MS } from '../../../config/limits.ts';
import { Atom, AsyncResult } from 'effect/reactivity';
import type {
  RuntimeConnection,
  WorktreeScope,
} from '../../../shared/api/connection.ts';
import { porcelainClient } from '../../../shared/api/client.ts';
import { clientRuntime } from '../../../shared/api/runtime.ts';
import { retainRead, worktreeRead } from '../../../shared/api/worktree-read.ts';
import { currentAnswerEffect } from '../../../shared/api/stale-answer.ts';
import { readSummaryHtml, type SummaryDelivery } from '../api.ts';
import type { ReviewResponse } from '../rules/review.ts';

const summaryPages = Atom.family(
  (_identity: {
    connection: RuntimeConnection;
    scope: WorktreeScope;
    token: string;
  }) =>
    Atom.make<Option.Option<string>>(Option.none()).pipe(
      Atom.setIdleTTL(PUBLISHED_REVIEW_REFRESH_MS),
    ),
);

export const readReviewSummary = Atom.family(
  ({
    connection,
    scope,
    summary,
    delivery,
  }: {
    connection: RuntimeConnection;
    scope: WorktreeScope;
    summary: ReviewResponse['summary'];
    delivery?: SummaryDelivery;
  }) => {
    const page = summaryPages({ connection, scope, token: summary.token });
    const read = clientRuntime(connection).atom(
      readSummaryHtml(connection, summary, delivery).pipe(
        Effect.tap(() => currentAnswerEffect(connection)),
      ),
    );
    return Atom.transform(read, (get) => {
      const cached = get(page);
      if (Option.isSome(cached)) return AsyncResult.success(cached.value);
      const result = get(read);
      if (AsyncResult.isSuccess(result))
        get.set(page, Option.some(result.value));
      return result;
    }).pipe(Atom.setIdleTTL(0));
  },
);

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
          connection,
          result === null ||
            (result.environmentId === connection.environmentId &&
              result.worktreeId === scope.worktreeId),
        );
        return result;
      }),
      clientRuntime(connection),
    ).pipe(
      retainRead,
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
        yield* currentAnswerEffect(connection, file.id === proofId);
        return file;
      }),
      clientRuntime(connection),
    ),
);
