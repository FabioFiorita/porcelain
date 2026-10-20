import { GitHubReadError } from '@porcelain/reviews/errors';
import { Effect, Layer, Schema } from 'effect';
import {
  captureGitPlatform,
  listGitHubAccounts,
  readGitHubApi,
} from '@porcelain/git/discovery';
import { GitHubReader } from '@porcelain/reviews/ports';
import {
  githubPullRequestSchema,
  githubPullSummarySchema,
} from '@porcelain/reviews/models';
import type { Limits } from '../../config/limits.ts';

const PAGE = 'pageInfo { hasNextPage }';
const summaryFields = `number title url state isDraft author { login } headRefName updatedAt
  commits(last: 1) { nodes { commit { statusCheckRollup { state contexts(first: 100) {
    nodes { __typename ... on CheckRun { name status conclusion detailsUrl } ... on StatusContext { context state targetUrl } } ${PAGE}
  } } } } }`;
const detailQuery = `query PullRequestRead($owner: String!, $repo: String!, $number: Int!) {
  repository(owner: $owner, name: $repo) { pullRequest(number: $number) {
    ${summaryFields} body baseRefName headRefOid mergeable
    labels(first: 50) { nodes { name color } ${PAGE} }
    comments(first: 50) { nodes { id author { login } createdAt body url } ${PAGE} }
    reviews(first: 50) { nodes { id author { login } submittedAt body url state
      comments(first: 50) { nodes { id author { login } createdAt body url path line originalLine } ${PAGE} }
    } ${PAGE} }
  } }
}`;
const listQuery = `query PullRequestList($owner: String!, $repo: String!) {
  repository(owner: $owner, name: $repo) {
    open: pullRequests(first: 50, states: [OPEN], orderBy: {field: UPDATED_AT, direction: DESC}) { nodes { ${summaryFields} } ${PAGE} }
    recent: pullRequests(first: 50, states: [CLOSED, MERGED], orderBy: {field: UPDATED_AT, direction: DESC}) { nodes { ${summaryFields} } ${PAGE} }
  }
}`;
const listPage = Schema.Struct({
  nodes: Schema.Array(githubPullSummarySchema),
  pageInfo: Schema.Struct({ hasNextPage: Schema.Boolean }),
});
const listSchema = Schema.Struct({
  data: Schema.Struct({
    repository: Schema.Struct({ open: listPage, recent: listPage }),
  }),
});
const detailSchema = Schema.Struct({
  data: Schema.Struct({
    repository: Schema.Struct({ pullRequest: githubPullRequestSchema }),
  }),
});

export const ghPullRequestReaderLayer = (limits: Limits['git']) =>
  Layer.effect(
    GitHubReader,
    Effect.gen(function* () {
      const provide = yield* captureGitPlatform();
      const api = Effect.fn('GitHubReader.api')(function* (
        input: Parameters<typeof readGitHubApi>[0],
      ) {
        return yield* readGitHubApi(input, limits).pipe(
          provide,
          Effect.mapError(
            (error) => new GitHubReadError({ reason: error.reason }),
          ),
        );
      });
      return GitHubReader.of({
        accounts: () =>
          listGitHubAccounts(limits).pipe(
            provide,
            Effect.mapError(
              (error) => new GitHubReadError({ reason: error.reason }),
            ),
          ),
        canRead: (input) =>
          api({
            account: input.account,
            endpoint: `repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}`,
          }).pipe(
            Effect.as(true),
            Effect.catchIf(
              (error) => error.reason === 'no-access',
              () => Effect.succeed(false),
            ),
          ),
        read: Effect.fn('GitHubReader.read')(function* (input) {
          const json = yield* api({
            account: input.account,
            endpoint: 'graphql',
            query: detailQuery,
            variables: {
              owner: input.owner,
              repo: input.repo,
              number: input.number,
            },
          });
          const decoded = yield* Schema.decodeEffect(
            Schema.fromJsonString(detailSchema),
          )(json).pipe(
            Effect.mapError(
              () => new GitHubReadError({ reason: 'invalid-response' }),
            ),
          );
          return decoded.data.repository.pullRequest;
        }),
        list: Effect.fn('GitHubReader.list')(function* (input) {
          const json = yield* api({
            account: input.account,
            endpoint: 'graphql',
            query: listQuery,
            variables: { owner: input.owner, repo: input.repo },
          });
          const decoded = yield* Schema.decodeEffect(
            Schema.fromJsonString(listSchema),
          )(json).pipe(
            Effect.mapError(
              () => new GitHubReadError({ reason: 'invalid-response' }),
            ),
          );
          const { open, recent } = decoded.data.repository;
          return {
            open: open.nodes,
            recent: recent.nodes,
            truncated: open.pageInfo.hasNextPage || recent.pageInfo.hasNextPage,
          };
        }),
      });
    }),
  );
