import { Effect, Option } from 'effect';
import { Atom, AtomRegistry, AsyncResult, Reactivity } from 'effect/reactivity';
import type { RuntimeConnection } from '../../../shared/api/connection.ts';
import { requestApi, type PorcelainApi } from '../../../shared/api/client.ts';
import { clientRuntime } from '../../../shared/api/runtime.ts';
import { currentAnswerEffect } from '../../../shared/api/stale-answer.ts';
import { queryKeys } from '../../../shared/api/query-keys.ts';
import { ReadSubscriptions } from '../../../shared/api/read-subscriptions.ts';

type ReviewInput = { connection: RuntimeConnection; reviewId: string };
type RevisionInput = ReviewInput & { revision: number };
type ReviewReadInput = ReviewInput & { revision?: number };
function query<A, E>(
  connection: RuntimeConnection,
  request: (api: PorcelainApi) => Effect.Effect<A, E>,
  accepts: (answer: A) => boolean = () => true,
) {
  return clientRuntime(connection)
    .atom(
      Effect.gen(function* () {
        const answer = yield* requestApi(connection, request);
        yield* currentAnswerEffect(connection, accepts(answer));
        return answer;
      }),
    )
    .pipe(
      connection.atoms.withReactivity([
        queryKeys.environment(connection.environmentId),
        queryKeys.inventory(connection.environmentId),
      ]),
      Atom.setIdleTTL(0),
    );
}
function reactive(input: ReviewInput, watch = false) {
  return <A, E>(atom: Atom.Atom<AsyncResult.AsyncResult<A, E>>) => {
    const read = atom.pipe(
      input.connection.atoms.withReactivity([
        queryKeys.durableReview(input.connection.environmentId, input.reviewId),
      ]),
    );
    return Atom.transform(read, (get) => {
      if (watch) get.mount(readReview(input));
      return get(read);
    });
  };
}
function requestReview(input: ReviewReadInput, api: PorcelainApi) {
  return (
    input.revision === undefined
      ? api.reviews.readReview({ params: { reviewId: input.reviewId } })
      : api.reviews.readReviewRevision({
          params: { reviewId: input.reviewId, revision: input.revision },
        })
  ).pipe(
    Effect.catchTag('ReviewNotFoundError', () =>
      Effect.succeed({
        review: undefined,
        revisions: [],
        revision: undefined,
      }),
    ),
  );
}

function acceptsReview(
  input: ReviewReadInput,
  answer: Effect.Success<ReturnType<typeof requestReview>>,
) {
  return (
    (answer.review === undefined ||
      answer.review.reviewId === input.reviewId) &&
    (answer.revision === undefined ||
      ((input.revision === undefined ||
        answer.revision.revision === input.revision) &&
        answer.revision.content.environmentId ===
          input.connection.environmentId))
  );
}

export const readReview = Atom.family((input: ReviewReadInput) => {
  const read = query(
    input.connection,
    (api) => requestReview(input, api),
    (answer) => acceptsReview(input, answer),
  ).pipe(
    input.connection.atoms.withReactivity([
      queryKeys.durableReview(input.connection.environmentId, input.reviewId),
    ]),
  );
  const watched = clientRuntime(input.connection)
    .atom((get) =>
      Effect.gen(function* () {
        const result = get(read);
        const answer = Option.getOrUndefined(AsyncResult.value(result));
        const reads = yield* ReadSubscriptions;
        const registration = {
          reviewId: input.reviewId,
          surface: 'review',
          settled: AtomRegistry.getResult(get.registry, read, {
            suspendOnWaiting: true,
          }).pipe(Effect.ignore, Effect.asVoid),
        };
        if (!answer) yield* reads.retain(registration);
        if (
          answer?.review?.state === 'open' &&
          !answer.review.archived &&
          answer.revision
        ) {
          yield* reads.retain({
            ...registration,
            projectId: answer.review.projectId,
            worktreeId: answer.revision.content.worktreeId,
            paths: [],
          });
        }
        return result;
      }),
    )
    .pipe(
      Atom.map((result) => AsyncResult.flatMap(result, (answer) => answer)),
      Atom.setIdleTTL(0),
    );
  return Atom.transform(read, (get) => get(watched)).pipe(Atom.setIdleTTL(0));
});
export const readProjectReviews = Atom.family(
  (input: { connection: RuntimeConnection; projectId: string }) => {
    const read = query(
      input.connection,
      (api) =>
        api.reviews.listProjectReviews({
          params: { projectId: input.projectId },
        }),
      (answer) =>
        answer.every((review) => review.projectId === input.projectId),
    ).pipe(
      input.connection.atoms.withReactivity([
        queryKeys.projectReviews(
          input.connection.environmentId,
          input.projectId,
        ),
      ]),
    );
    return Atom.transform(read, (get) => {
      const result = get(read);
      const reviews = Option.getOrUndefined(AsyncResult.value(result));
      const reactivity = input.connection.runtime.runSync(
        Reactivity.Reactivity,
      );
      get.addFinalizer(
        reactivity.registerUnsafe(
          reviews
            ? reviews.map((review) =>
                queryKeys.durableReview(
                  input.connection.environmentId,
                  review.reviewId,
                ),
              )
            : [queryKeys.projectReviews(input.connection.environmentId)],
          () => get.refresh(read),
        ),
      );
      return result;
    }).pipe(Atom.setIdleTTL(0));
  },
);
export const readReviewMarks = Atom.family((input: ReviewInput) =>
  query(input.connection, (api) =>
    api.reviews.listReviewMarks({ params: { reviewId: input.reviewId } }),
  ).pipe(reactive(input, true)),
);
export const readReviewComments = Atom.family((input: ReviewInput) =>
  query(
    input.connection,
    (api) =>
      api.reviews.listReviewCommentThreads({
        params: { reviewId: input.reviewId },
      }),
    (threads) =>
      threads.every((thread) => thread.review?.reviewId === input.reviewId),
  ).pipe(reactive(input, true)),
);
export const readReviewRevisionFile = Atom.family(
  (input: RevisionInput & { path: string }) =>
    query(input.connection, (api) =>
      api.reviews.readReviewFile({
        params: { reviewId: input.reviewId, revision: input.revision },
        query: { path: input.path },
      }),
    ),
);
export const readReviewRevisionDiffs = Atom.family(
  (input: RevisionInput & { paths: readonly (readonly string[])[] }) =>
    query(input.connection, (api) =>
      api.reviews.readReviewDiffs({
        params: { reviewId: input.reviewId, revision: input.revision },
        payload: { paths: input.paths },
      }),
    ),
);
export const readReviewRevisionProof = Atom.family(
  (input: RevisionInput & { proofId: string }) =>
    query(
      input.connection,
      (api) =>
        api.reviews.readReviewProofFile({
          params: { reviewId: input.reviewId, revision: input.revision },
          query: { proofId: input.proofId },
        }),
      (answer) => answer.id === input.proofId,
    ),
);

export const readReviewComparison = Atom.family(
  (input: ReviewInput & { from?: number; to?: number }) =>
    query(
      input.connection,
      (api) =>
        api.reviews.compareReview({
          params: { reviewId: input.reviewId },
          query: { from: input.from, to: input.to },
        }),
      (answer) =>
        answer.reviewId === input.reviewId &&
        (input.from === undefined || answer.from === input.from) &&
        (input.to === undefined || answer.to === input.to),
    ).pipe(reactive(input)),
);
export const readReviewInterdiff = Atom.family(
  (input: ReviewInput & { from?: number; to?: number; path: string }) =>
    query(
      input.connection,
      (api) =>
        api.reviews.readReviewInterdiff({
          params: { reviewId: input.reviewId },
          query: { from: input.from, to: input.to, path: input.path },
        }),
      (answer) =>
        answer.kind === 'unavailable' ||
        (answer.path === input.path &&
          (input.from === undefined || answer.from === input.from) &&
          (input.to === undefined || answer.to === input.to)),
    ).pipe(reactive(input)),
);
export const readReviewPullRequest = Atom.family((input: ReviewInput) =>
  query(input.connection, (api) =>
    api.reviews.readReviewPullRequest({ params: { reviewId: input.reviewId } }),
  ).pipe(reactive(input, true)),
);
export const readProjectPullRequests = Atom.family(
  (input: { connection: RuntimeConnection; projectId: string }) =>
    query(input.connection, (api) =>
      api.reviews.listProjectPullRequests({
        params: { projectId: input.projectId },
      }),
    ).pipe(
      input.connection.atoms.withReactivity([
        queryKeys.projectReviews(input.connection.environmentId),
        queryKeys.projectReviews(
          input.connection.environmentId,
          input.projectId,
        ),
      ]),
    ),
);
export const readProjectGitHubAccount = Atom.family(
  (input: { connection: RuntimeConnection; projectId: string }) =>
    query(input.connection, (api) =>
      api.reviews.readProjectGitHubAccount({
        params: { projectId: input.projectId },
      }),
    ),
);
export const observeReviewSeen = Atom.family((input: RevisionInput) =>
  clientRuntime(input.connection)
    .atom(
      Effect.gen(function* () {
        const selection = {
          connection: input.connection,
          reviewId: input.reviewId,
        };
        const current = yield* requestApi(input.connection, (api) =>
          requestReview(selection, api),
        );
        yield* currentAnswerEffect(
          input.connection,
          acceptsReview(selection, current),
        );
        if (
          !current.review ||
          current.review.lastSeenRevision >= input.revision
        )
          return { updated: false };
        return yield* requestApi(input.connection, (api) =>
          api.reviews.setReviewSeen({
            params: { reviewId: input.reviewId },
            payload: { revision: input.revision },
          }),
        );
      }),
    )
    .pipe(
      input.connection.atoms.withReactivity([
        queryKeys.environment(input.connection.environmentId),
      ]),
      Atom.keepAlive,
    ),
);
