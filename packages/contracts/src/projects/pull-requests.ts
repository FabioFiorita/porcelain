import { nullableAsUndefined } from '../shared/schema.ts';
import { Schema } from 'effect';
import {
  githubUnavailableSchema,
  githubAccountResultSchema,
  pullRequestSchema,
  pullRequestSummarySchema,
  pullChecksResultSchema,
  pullRequestMergeMethodSchema,
} from '@porcelain/reviews/models';
export const readPullRequestResponseSchema = Schema.Union([
  Schema.Struct({
    kind: Schema.Literal('available'),
    account: Schema.String,
    pullRequest: pullRequestSchema,
  }),
  githubUnavailableSchema,
]);
export const listPullRequestsResponseSchema = Schema.Union([
  Schema.Struct({
    kind: Schema.Literal('available'),
    account: Schema.String,
    pullRequests: Schema.Array(pullRequestSummarySchema),
    truncated: Schema.Boolean,
    recentlyClosedSince: Schema.String,
  }),
  githubUnavailableSchema,
]);
export const setGitHubAccountRequestSchema = Schema.Struct({
  account: nullableAsUndefined(
    Schema.String.check(
      Schema.isPattern(/^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,38})$/),
    ),
  ),
});
export { githubAccountResultSchema };
export type ReadPullRequestResponse = typeof readPullRequestResponseSchema.Type;
export type ListPullRequestsResponse =
  typeof listPullRequestsResponseSchema.Type;
export type GitHubAccountResponse = typeof githubAccountResultSchema.Type;
export type SetGitHubAccountRequest = typeof setGitHubAccountRequestSchema.Type;

const projectGitHubAccountOverrideSchema = Schema.Struct({
  override: Schema.optionalKey(setGitHubAccountRequestSchema),
});
export type ProjectGitHubAccountOverride =
  typeof projectGitHubAccountOverrideSchema.Type;

export const readPullChecksResponseSchema = Schema.Union([
  Schema.Struct({
    kind: Schema.Literal('available'),
    number: Schema.Int,
    checks: pullChecksResultSchema,
  }),
  githubUnavailableSchema,
]);
export type ReadPullChecksResponse = typeof readPullChecksResponseSchema.Type;

export const projectParamsSchema = Schema.Struct({ projectId: Schema.String });
export type ProjectParams = typeof projectParamsSchema.Type;
export const projectPullRequestParamsSchema = Schema.Struct({
  projectId: Schema.String,
  number: Schema.NumberFromString.check(
    Schema.isInt(),
    Schema.isGreaterThan(0),
  ),
});
export type ProjectPullRequestParams =
  typeof projectPullRequestParamsSchema.Type;

export const mergePullRequestRequestSchema = Schema.Struct({
  method: pullRequestMergeMethodSchema,
  headSha: Schema.String.check(Schema.isPattern(/^[0-9a-f]{40}$/)),
});
export type MergePullRequestRequest = typeof mergePullRequestRequestSchema.Type;
export const mergePullRequestResponseSchema = Schema.Struct({
  merged: Schema.Literal(true),
});
export type MergePullRequestResponse =
  typeof mergePullRequestResponseSchema.Type;
export type { PullRequestMergeMethod } from '@porcelain/reviews/models';
