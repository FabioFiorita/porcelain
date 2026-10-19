import { Effect } from 'effect';
import { Atom } from 'effect/reactivity';
import type { RuntimeConnection } from '../../../shared/api/connection.ts';
import { requestApi, type PorcelainApi } from '../../../shared/api/client.ts';
import { clientRuntime } from '../../../shared/api/runtime.ts';
import { currentAnswerEffect } from '../../../shared/api/stale-answer.ts';
import { queryKeys } from '../../../shared/api/query-keys.ts';

type ReviewInput = { connection: RuntimeConnection; reviewId: string };
type RevisionInput = ReviewInput & { revision: number };
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
function reactive(input: ReviewInput) {
  return input.connection.atoms.withReactivity([
    queryKeys.projectReviews(input.connection.environmentId),
    queryKeys.durableReview(input.connection.environmentId, input.reviewId),
  ]);
}
export const readReview = Atom.family(
  (input: ReviewInput & { revision?: number }) =>
    query(
      input.connection,
      (api) =>
        input.revision === undefined
          ? api.reviews.readReview({ params: { reviewId: input.reviewId } })
          : api.reviews.readReviewRevision({
              params: { reviewId: input.reviewId, revision: input.revision },
            }),
      (answer) =>
        answer.review?.reviewId === input.reviewId &&
        (input.revision === undefined ||
          answer.revision?.revision === input.revision) &&
        answer.revision?.content.environmentId ===
          input.connection.environmentId,
    ).pipe(reactive(input)),
);
export const readProjectReviews = Atom.family(
  (input: { connection: RuntimeConnection; projectId: string }) =>
    query(
      input.connection,
      (api) =>
        api.reviews.listProjectReviews({
          params: { projectId: input.projectId },
        }),
      (answer) =>
        answer.every((review) => review.projectId === input.projectId),
    ).pipe(
      input.connection.atoms.withReactivity([
        queryKeys.projectReviews(input.connection.environmentId),
      ]),
    ),
);
export const readReviewMarks = Atom.family((input: ReviewInput) =>
  query(input.connection, (api) =>
    api.reviews.listReviewMarks({ params: { reviewId: input.reviewId } }),
  ).pipe(reactive(input)),
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
  ).pipe(reactive(input)),
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
  ).pipe(reactive(input)),
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
