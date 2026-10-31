import { nullableAsUndefined } from '../shared/schema.ts';
import { Schema } from 'effect';
import {
  githubUnavailableSchema,
  githubAccountResultSchema,
  pullRequestSchema,
  pullRequestSummarySchema,
  pullChecksResultSchema,
} from '@porcelain/reviews/models';
export const readPullRequestResponseSchema = Schema.Union([
  Schema.Struct({
    kind: Schema.Literal('available'),
    account: Schema.String,
    pullRequest: pullRequestSchema,
  }),
  Schema.Struct({ kind: Schema.Literal('not-linked') }),
  githubUnavailableSchema,
]);
export const listPullRequestsResponseSchema = Schema.Union([
  Schema.Struct({
    kind: Schema.Literal('available'),
    account: Schema.String,
    pullRequests: Schema.Array(
      Schema.Struct({
        ...pullRequestSummarySchema.fields,
        reviewId: Schema.optional(Schema.String),
      }),
    ),
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

export const setReviewPullRequestRequestSchema = Schema.Struct({
  pullRequest: nullableAsUndefined(
    Schema.String.check(
      Schema.isPattern(
        /^https:\/\/github\.com\/[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+\/pull\/[1-9][0-9]*$/,
      ),
    ),
  ),
});
export const setReviewPullRequestResponseSchema = Schema.Union([
  Schema.Struct({ kind: Schema.Literal('updated') }),
  githubUnavailableSchema,
]);
export type SetReviewPullRequestRequest =
  typeof setReviewPullRequestRequestSchema.Type;
export type SetReviewPullRequestResponse =
  typeof setReviewPullRequestResponseSchema.Type;

export const readPullChecksResponseSchema = Schema.Union([
  Schema.Struct({
    kind: Schema.Literal('available'),
    number: Schema.Int,
    checks: pullChecksResultSchema,
  }),
  Schema.Struct({ kind: Schema.Literal('not-linked') }),
  githubUnavailableSchema,
]);
export type ReadPullChecksResponse = typeof readPullChecksResponseSchema.Type;
