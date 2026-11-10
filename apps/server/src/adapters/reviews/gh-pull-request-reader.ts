import {
  GitHubPullRequestNotFoundError,
  GitHubReadError,
} from '@porcelain/reviews/errors';
import { Effect, Layer, Schema } from 'effect';
import {
  captureGitPlatform,
  listGitHubAccounts,
  readGitHubApi,
} from '@porcelain/git/discovery';
import { GitHubReader } from '@porcelain/reviews/ports';
import {
  githubPullRequestSchema,
  githubPullChecksSchema,
  githubPullSummarySchema,
} from '@porcelain/reviews/models';
import type { Limits } from '../../config/limits.ts';

const PAGE = 'pageInfo { hasNextPage }';
const SUMMARY_FIELDS = `number title url state isDraft author { login avatarUrl(size: 48) } headRefName updatedAt`;
const ROLLUP_FIELDS = `commits(last: 1) { nodes { commit { statusCheckRollup { state } } } }`;
const CHECK_FIELDS = `commits(last: 1) { nodes { commit { statusCheckRollup { state contexts(first: 100) {
    nodes { __typename ... on CheckRun { name status conclusion detailsUrl startedAt completedAt } ... on StatusContext { context state targetUrl } } ${PAGE}
  } } } } }`;
const detailQuery = `query PullRequestRead($owner: String!, $repo: String!, $number: Int!) {
  repository(owner: $owner, name: $repo) { pullRequest(number: $number) {
    ${SUMMARY_FIELDS} ${CHECK_FIELDS} body createdAt baseRefName headRefOid mergeable bodyHTML
    labels(first: 50) { nodes { name color } ${PAGE} }
    comments(first: 50) { nodes { id author { login avatarUrl(size: 48) } createdAt body url } ${PAGE} }
    reviews(first: 50) { nodes { id author { login avatarUrl(size: 48) } submittedAt createdAt body url state
      comments(first: 50) { nodes { id author { login avatarUrl(size: 48) } createdAt body url path line originalLine diffHunk } ${PAGE} }
    } ${PAGE} }
  } }
}`;
const CHECKS_QUERY = `query PullRequestChecks($owner: String!, $repo: String!, $number: Int!) {
  repository(owner: $owner, name: $repo) { pullRequest(number: $number) {
    number commits(last: 1) { nodes { commit { statusCheckRollup { state } } } }
  } }
}`;
const checksSchema = Schema.Struct({
  data: Schema.Struct({
    repository: Schema.Struct({
      pullRequest: Schema.NullOr(githubPullChecksSchema),
    }),
  }),
});
const listQuery = `query PullRequestList($owner: String!, $repo: String!, $cursor: String) {
  repository(owner: $owner, name: $repo) {
    open: pullRequests(first: 50, after: $cursor, states: [OPEN], orderBy: {field: UPDATED_AT, direction: DESC}) { nodes { ${SUMMARY_FIELDS} ${ROLLUP_FIELDS} } pageInfo { hasNextPage endCursor } }
    recent: pullRequests(first: 50, states: [CLOSED, MERGED], orderBy: {field: UPDATED_AT, direction: DESC}) { nodes { ${SUMMARY_FIELDS} ${ROLLUP_FIELDS} } ${PAGE} }
  }
}`;
const listPage = Schema.Struct({
  nodes: Schema.Array(githubPullSummarySchema),
  pageInfo: Schema.Struct({
    hasNextPage: Schema.Boolean,
    endCursor: Schema.optional(Schema.NullOr(Schema.String)),
  }),
});
const listSchema = Schema.Struct({
  data: Schema.Struct({
    repository: Schema.Struct({ open: listPage, recent: listPage }),
  }),
});
const detailSchema = Schema.Struct({
  data: Schema.Struct({
    repository: Schema.Struct({
      pullRequest: Schema.NullOr(githubPullRequestSchema),
    }),
  }),
});

const unavailable = (error: {
  readonly reason: GitHubReadError['reason'] | 'not-found';
}) =>
  new GitHubReadError({
    reason: error.reason === 'not-found' ? 'invalid-response' : error.reason,
  });

export const ghPullRequestReaderLayer = (limits: Limits['git']) =>
  Layer.effect(
    GitHubReader,
    Effect.gen(function* () {
      const provide = yield* captureGitPlatform();
      const api = Effect.fn('GitHubReader.api')(function* (
        input: Parameters<typeof readGitHubApi>[0],
      ) {
        return yield* readGitHubApi(input, limits).pipe(provide);
      });
      return GitHubReader.of({
        accounts: () =>
          listGitHubAccounts(limits).pipe(
            provide,
            Effect.mapError(unavailable),
          ),
        canRead: (input) =>
          api({
            account: input.account,
            endpoint: `repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}`,
          }).pipe(
            Effect.mapError(unavailable),
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
          }).pipe(
            Effect.mapError((error) =>
              error.reason === 'not-found'
                ? new GitHubPullRequestNotFoundError()
                : unavailable(error),
            ),
          );
          const decoded = yield* Schema.decodeEffect(
            Schema.fromJsonString(detailSchema),
          )(json).pipe(
            Effect.mapError(
              () => new GitHubReadError({ reason: 'invalid-response' }),
            ),
          );
          const pullRequest = decoded.data.repository.pullRequest;
          if (pullRequest === null)
            return yield* new GitHubPullRequestNotFoundError();
          return pullRequest;
        }),
        checks: Effect.fn('GitHubReader.checks')(function* (input) {
          const json = yield* api({
            account: input.account,
            endpoint: 'graphql',
            query: CHECKS_QUERY,
            variables: {
              owner: input.owner,
              repo: input.repo,
              number: input.number,
            },
          }).pipe(
            Effect.mapError((error) =>
              error.reason === 'not-found'
                ? new GitHubPullRequestNotFoundError()
                : unavailable(error),
            ),
          );
          const decoded = yield* Schema.decodeEffect(
            Schema.fromJsonString(checksSchema),
          )(json).pipe(
            Effect.mapError(
              () => new GitHubReadError({ reason: 'invalid-response' }),
            ),
          );
          const pullRequest = decoded.data.repository.pullRequest;
          if (pullRequest === null)
            return yield* new GitHubPullRequestNotFoundError();
          return pullRequest;
        }),
        list: Effect.fn('GitHubReader.list')(function* (input) {
          const open: (typeof githubPullSummarySchema.Type)[] = [];
          let cursor: string | undefined;
          let recent: readonly (typeof githubPullSummarySchema.Type)[] = [];
          let truncated = false;
          do {
            const json = yield* api({
              account: input.account,
              endpoint: 'graphql',
              query: listQuery,
              variables: {
                owner: input.owner,
                repo: input.repo,
                ...(cursor === undefined ? {} : { cursor }),
              },
            }).pipe(Effect.mapError(unavailable));
            const decoded = yield* Schema.decodeEffect(
              Schema.fromJsonString(listSchema),
            )(json).pipe(
              Effect.mapError(
                () => new GitHubReadError({ reason: 'invalid-response' }),
              ),
            );
            const page = decoded.data.repository;
            open.push(...page.open.nodes);
            if (cursor === undefined) {
              recent = page.recent.nodes;
              truncated = page.recent.pageInfo.hasNextPage;
            }
            if (!page.open.pageInfo.hasNextPage) break;
            const next = page.open.pageInfo.endCursor;
            if (!next || next === cursor)
              return yield* new GitHubReadError({ reason: 'invalid-response' });
            cursor = next;
          } while (true);
          return { open, recent, truncated };
        }),
      });
    }),
  );
