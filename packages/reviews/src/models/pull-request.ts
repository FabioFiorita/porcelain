import { Schema } from 'effect';

export const githubUnavailableReasonSchema = Schema.Literals([
  'gh-not-installed',
  'no-accounts',
  'no-access',
  'not-github',
  'rate-limited',
  'offline',
  'invalid-response',
]);
export const githubUnavailableSchema = Schema.Struct({
  kind: Schema.Literal('unavailable'),
  reason: githubUnavailableReasonSchema,
});
export type GitHubRepository = { owner: string; repo: string };
const githubChoiceSchema = Schema.Struct({
  account: Schema.String,
  source: Schema.Literals(['detected', 'overridden']),
});
export type GitHubChoice = typeof githubChoiceSchema.Type;
export type GitHubAccountPreference = {
  repository: string;
  detected: string | undefined;
  override: string | undefined;
};
export const githubAccountResultSchema = Schema.Struct({
  accounts: Schema.Array(Schema.String),
  choice: Schema.optional(githubChoiceSchema),
  override: Schema.optional(Schema.String),
  unavailable: Schema.optional(githubUnavailableSchema),
});
export type GitHubAccountResult = typeof githubAccountResultSchema.Type;
const authorSchema = Schema.NullOr(Schema.Struct({ login: Schema.String }));
const pageInfoSchema = Schema.Struct({ hasNextPage: Schema.Boolean });
const checkSchema = Schema.Union([
  Schema.Struct({
    __typename: Schema.Literal('CheckRun'),
    name: Schema.String,
    status: Schema.String,
    conclusion: Schema.NullOr(Schema.String),
    detailsUrl: Schema.NullOr(Schema.String),
  }),
  Schema.Struct({
    __typename: Schema.Literal('StatusContext'),
    context: Schema.String,
    state: Schema.String,
    targetUrl: Schema.NullOr(Schema.String),
  }),
]);
export const githubPullSummarySchema = Schema.Struct({
  number: Schema.Int,
  title: Schema.String,
  url: Schema.String,
  state: Schema.Literals(['OPEN', 'CLOSED', 'MERGED']),
  isDraft: Schema.Boolean,
  author: authorSchema,
  headRefName: Schema.String,
  updatedAt: Schema.String,
  commits: Schema.Struct({
    nodes: Schema.Array(
      Schema.Struct({
        commit: Schema.Struct({
          statusCheckRollup: Schema.NullOr(
            Schema.Struct({
              state: Schema.String,
              contexts: Schema.Struct({
                nodes: Schema.Array(checkSchema),
                pageInfo: pageInfoSchema,
              }),
            }),
          ),
        }),
      }),
    ),
  }),
});
const commentSchema = Schema.Struct({
  id: Schema.String,
  author: authorSchema,
  createdAt: Schema.String,
  body: Schema.String,
  url: Schema.String,
});
export const githubPullRequestSchema = Schema.Struct({
  ...githubPullSummarySchema.fields,
  body: Schema.String,
  baseRefName: Schema.String,
  headRefOid: Schema.String,
  mergeable: Schema.String,
  labels: Schema.Struct({
    nodes: Schema.Array(
      Schema.Struct({ name: Schema.String, color: Schema.String }),
    ),
    pageInfo: pageInfoSchema,
  }),
  comments: Schema.Struct({
    nodes: Schema.Array(commentSchema),
    pageInfo: pageInfoSchema,
  }),
  reviews: Schema.Struct({
    nodes: Schema.Array(
      Schema.Struct({
        id: Schema.String,
        author: authorSchema,
        submittedAt: Schema.NullOr(Schema.String),
        body: Schema.String,
        url: Schema.String,
        state: Schema.String,
        comments: Schema.Struct({
          nodes: Schema.Array(
            Schema.Struct({
              ...commentSchema.fields,
              path: Schema.String,
              line: Schema.NullOr(Schema.Int),
              originalLine: Schema.NullOr(Schema.Int),
            }),
          ),
          pageInfo: pageInfoSchema,
        }),
      }),
    ),
    pageInfo: pageInfoSchema,
  }),
});
export type GitHubPullRequest = typeof githubPullRequestSchema.Type;
export type GitHubPullSummary = typeof githubPullSummarySchema.Type;
const pullCheckSchema = Schema.Struct({
  name: Schema.String,
  status: Schema.String,
  conclusion: Schema.optional(Schema.String),
  detailsUrl: Schema.optional(Schema.String),
});
export const pullRequestSummarySchema = Schema.Struct({
  number: Schema.Int,
  title: Schema.String,
  url: Schema.String,
  state: Schema.Literals(['open', 'closed', 'merged']),
  draft: Schema.Boolean,
  author: Schema.optional(Schema.String),
  headBranch: Schema.String,
  updatedAt: Schema.String,
  checksSummary: Schema.optional(Schema.String),
  checksTruncated: Schema.Boolean,
});
const pullTimelineItemSchema = Schema.Struct({
  id: Schema.String,
  kind: Schema.Literals(['comment', 'review', 'review-comment']),
  author: Schema.optional(Schema.String),
  time: Schema.String,
  body: Schema.String,
  url: Schema.String,
  reviewState: Schema.optional(Schema.String),
  path: Schema.optional(Schema.String),
  line: Schema.optional(Schema.Int),
  originalLine: Schema.optional(Schema.Int),
});
export const pullRequestSchema = Schema.Struct({
  ...pullRequestSummarySchema.fields,
  description: Schema.String,
  baseBranch: Schema.String,
  headSha: Schema.String,
  matchesReviewHead: Schema.Boolean,
  mergeable: Schema.String,
  labels: Schema.Array(
    Schema.Struct({ name: Schema.String, color: Schema.String }),
  ),
  checks: Schema.Array(pullCheckSchema),
  timeline: Schema.Array(pullTimelineItemSchema),
  truncated: Schema.Boolean,
});
export type PullRequest = typeof pullRequestSchema.Type;
export type PullRequestSummary = typeof pullRequestSummarySchema.Type;
