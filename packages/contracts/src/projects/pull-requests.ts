import { nullableAsUndefined } from '../shared/schema.ts';
import { Schema } from 'effect';
import {
  githubUnavailableSchema,
  githubAccountResultSchema,
  pullRequestSchema,
  pullRequestSummarySchema,
  pullChecksResultSchema,
  pullRequestMergeMethodSchema,
  pullRequestStatusSchema,
  checkLogExcerptSchema,
  checkLogUnavailableReasonSchema,
  pullRequestRerunTargetSchema,
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

export const readPullStatusResponseSchema = Schema.Union([
  Schema.Struct({
    kind: Schema.Literal('available'),
    status: pullRequestStatusSchema,
  }),
  githubUnavailableSchema,
]);
export type ReadPullStatusResponse = typeof readPullStatusResponseSchema.Type;

export const projectPullJobParamsSchema = Schema.Struct({
  ...projectPullRequestParamsSchema.fields,
  jobId: Schema.NumberFromString.check(Schema.isInt(), Schema.isGreaterThan(0)),
});
export type ProjectPullJobParams = typeof projectPullJobParamsSchema.Type;
const isoTimeSchema = Schema.String.check(
  Schema.isPattern(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/),
);
export const readCheckLogQuerySchema = Schema.Struct({
  from: Schema.optional(isoTimeSchema),
  to: Schema.optional(isoTimeSchema),
});
export type ReadCheckLogQuery = typeof readCheckLogQuerySchema.Type;
export const readCheckLogResponseSchema = Schema.Union([
  Schema.Struct({
    kind: Schema.Literal('available'),
    excerpt: checkLogExcerptSchema,
  }),
  Schema.Struct({
    kind: Schema.Literal('unavailable'),
    reason: checkLogUnavailableReasonSchema,
  }),
]);
export type ReadCheckLogResponse = typeof readCheckLogResponseSchema.Type;

export const rerunPullChecksRequestSchema = Schema.Struct({
  headSha: Schema.String.check(Schema.isPattern(/^[0-9a-f]{40}$/)),
  target: pullRequestRerunTargetSchema,
});
export type RerunPullChecksRequest = typeof rerunPullChecksRequestSchema.Type;
export const rerunPullChecksResponseSchema = Schema.Struct({
  requested: Schema.Literal(true),
});
export type RerunPullChecksResponse = typeof rerunPullChecksResponseSchema.Type;

export const PULL_REQUEST_COMMENT_CHARACTERS = 65_536;
export const commentOnPullRequestRequestSchema = Schema.Struct({
  body: Schema.String.check(
    Schema.isMinLength(1),
    Schema.isMaxLength(PULL_REQUEST_COMMENT_CHARACTERS),
    Schema.isPattern(/\S/),
  ),
});
export type CommentOnPullRequestRequest =
  typeof commentOnPullRequestRequestSchema.Type;
export const commentOnPullRequestResponseSchema = Schema.Struct({
  url: Schema.String,
});
export type CommentOnPullRequestResponse =
  typeof commentOnPullRequestResponseSchema.Type;
export type {
  PullCheckDetail,
  PullRequestStatus,
  CheckLogLine,
  PullRequestRerunTarget,
} from '@porcelain/reviews/models';
