import {
  GitHubPullRequestNotFoundError,
  GitHubReadError,
} from '@porcelain/reviews/errors';
import { Effect, Layer, Schema } from 'effect';
import {
  captureGitPlatform,
  readGitHubApi,
  readGitHubJobLog,
} from '@porcelain/git/discovery';
import { GitHubCheckReader } from '@porcelain/reviews/ports';
import { githubPullStatusSchema } from '@porcelain/reviews/models';
import type { Limits } from '../../config/limits.ts';

const PAGE = 'pageInfo { hasNextPage }';
const STATUS_QUERY = `query PullRequestStatus($owner: String!, $repo: String!, $number: Int!) {
  repository(owner: $owner, name: $repo) { viewerPermission pullRequest(number: $number) {
    number state isDraft headRefOid mergeable mergeStateStatus reviewDecision
    reviewRequests(first: 20) { nodes { requestedReviewer { ... on User { login } ... on Bot { login } ... on Team { slug: combinedSlug } } } }
    commits(last: 1) { nodes { commit { statusCheckRollup { state contexts(first: 100) {
      nodes { __typename
        ... on CheckRun { databaseId name status conclusion detailsUrl startedAt completedAt isRequired(pullRequestNumber: $number) title summary
          checkSuite { app { name slug } workflowRun { databaseId workflow { name } } }
          steps(first: 50) { nodes { number name status conclusion startedAt completedAt } }
          annotations(first: 20) { nodes { annotationLevel message path title location { start { line } } } } }
        ... on StatusContext { context state targetUrl description isRequired(pullRequestNumber: $number) } }
      ${PAGE}
    } } } } }
  } }
}`;
const statusSchema = Schema.Struct({
  data: Schema.Struct({
    repository: Schema.Struct({
      viewerPermission: Schema.optional(Schema.NullOr(Schema.String)),
      pullRequest: Schema.NullOr(githubPullStatusSchema),
    }),
  }),
});
const unavailable = (error: {
  readonly reason: GitHubReadError['reason'] | 'not-found';
}) =>
  new GitHubReadError({
    reason: error.reason === 'not-found' ? 'invalid-response' : error.reason,
  });

export const ghCheckReaderLayer = (limits: Limits['git']) =>
  Layer.effect(
    GitHubCheckReader,
    Effect.gen(function* () {
      const provide = yield* captureGitPlatform();
      return GitHubCheckReader.of({
        status: Effect.fn('GitHubCheckReader.status')(function* (input) {
          const json = yield* readGitHubApi(
            {
              account: input.account,
              endpoint: 'graphql',
              query: STATUS_QUERY,
              variables: {
                owner: input.owner,
                repo: input.repo,
                number: input.number,
              },
            },
            limits,
          ).pipe(
            provide,
            Effect.mapError((error) =>
              error.reason === 'not-found'
                ? new GitHubPullRequestNotFoundError()
                : unavailable(error),
            ),
          );
          const { repository } = (yield* Schema.decodeEffect(
            Schema.fromJsonString(statusSchema),
          )(json).pipe(
            Effect.mapError(
              () => new GitHubReadError({ reason: 'invalid-response' }),
            ),
          )).data;
          if (repository.pullRequest === null)
            return yield* new GitHubPullRequestNotFoundError();
          return {
            ...repository.pullRequest,
            viewerPermission: repository.viewerPermission ?? undefined,
          };
        }),
        jobLog: (input) =>
          readGitHubJobLog(input, limits).pipe(
            provide,
            Effect.mapError(unavailable),
          ),
      });
    }),
  );
