import { Schema } from 'effect';

export const githubUnavailableReasonSchema = Schema.Literals([
  'gh-not-installed',
  'no-accounts',
  'no-access',
  'not-github',
  'rate-limited',
  'offline',
  'invalid-response',
  'pull-request-not-found',
]);
export const githubUnavailableSchema = Schema.Struct({
  kind: Schema.Literal('unavailable'),
  reason: githubUnavailableReasonSchema,
});
export type GitHubRepository = { owner: string; repo: string };
export const pullRequestMergeMethodSchema = Schema.Literals([
  'merge',
  'squash',
  'rebase',
]);
export type PullRequestMergeMethod = typeof pullRequestMergeMethodSchema.Type;
export const pullRequestMergeRefusalSchema = Schema.Literals([
  'not-mergeable',
  'head-changed',
  'gh-not-installed',
  'no-accounts',
  'no-access',
  'not-github',
  'rate-limited',
  'offline',
  'invalid-response',
  'pull-request-not-found',
]);
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
  repository: Schema.optional(Schema.String),
  accounts: Schema.Array(Schema.String),
  choice: Schema.optional(githubChoiceSchema),
  override: Schema.optional(Schema.String),
  unavailable: Schema.optional(githubUnavailableSchema),
});
export type GitHubAccountResult = typeof githubAccountResultSchema.Type;
const authorSchema = Schema.NullOr(
  Schema.Struct({
    login: Schema.String,
    avatarUrl: Schema.optional(Schema.String),
  }),
);
const pageInfoSchema = Schema.Struct({ hasNextPage: Schema.Boolean });
const checkRunSchema = Schema.Struct({
  __typename: Schema.Literal('CheckRun'),
  name: Schema.String,
  status: Schema.String,
  conclusion: Schema.NullOr(Schema.String),
  detailsUrl: Schema.NullOr(Schema.String),
  startedAt: Schema.optional(Schema.NullOr(Schema.String)),
  completedAt: Schema.optional(Schema.NullOr(Schema.String)),
});
const statusContextSchema = Schema.Struct({
  __typename: Schema.Literal('StatusContext'),
  context: Schema.String,
  state: Schema.String,
  targetUrl: Schema.NullOr(Schema.String),
});
const checkSchema = Schema.Union([checkRunSchema, statusContextSchema]);
const rollupSchema = Schema.Struct({ state: Schema.String });
const checkContextSchema = Schema.Struct({ pageInfo: pageInfoSchema });
export const githubPullSummarySchema = Schema.Struct({
  number: Schema.Int,
  title: Schema.String,
  url: Schema.String,
  state: Schema.Literals(['OPEN', 'CLOSED', 'MERGED']),
  isDraft: Schema.Boolean,
  author: authorSchema,
  headRefName: Schema.String,
  baseRefName: Schema.String,
  updatedAt: Schema.String,
  commits: Schema.Struct({
    nodes: Schema.Array(
      Schema.Struct({
        commit: Schema.Struct({
          statusCheckRollup: Schema.NullOr(rollupSchema),
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
  commits: Schema.Struct({
    nodes: Schema.Array(
      Schema.Struct({
        commit: Schema.Struct({
          statusCheckRollup: Schema.NullOr(
            Schema.Struct({
              ...rollupSchema.fields,
              contexts: Schema.Struct({
                nodes: Schema.Array(checkSchema),
                ...checkContextSchema.fields,
              }),
            }),
          ),
        }),
      }),
    ),
  }),
  body: Schema.String,
  bodyHTML: Schema.optional(Schema.String),
  createdAt: Schema.optional(Schema.String),
  baseRefName: Schema.String,
  headRefOid: Schema.String,
  headRepository: Schema.optional(
    Schema.NullOr(Schema.Struct({ url: Schema.String })),
  ),
  mergeable: Schema.String,
  allowedMergeMethods: Schema.optional(
    Schema.Array(pullRequestMergeMethodSchema),
  ),
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
        createdAt: Schema.optional(Schema.String),
        body: Schema.String,
        url: Schema.String,
        state: Schema.String,
        comments: Schema.Struct({
          nodes: Schema.Array(
            Schema.Struct({
              ...commentSchema.fields,
              path: Schema.String,
              diffHunk: Schema.optional(Schema.String),
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
  durationMs: Schema.optional(Schema.Int),
});
export const pullRequestSummarySchema = Schema.Struct({
  number: Schema.Int,
  title: Schema.String,
  url: Schema.String,
  state: Schema.Literals(['open', 'closed', 'merged']),
  draft: Schema.Boolean,
  author: Schema.optional(Schema.String),
  headBranch: Schema.String,
  baseBranch: Schema.String,
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
  authorAvatarUrl: Schema.optional(Schema.String),
  reviewId: Schema.optional(Schema.String),
  diffHunk: Schema.optional(Schema.String),
  path: Schema.optional(Schema.String),
  line: Schema.optional(Schema.Int),
  originalLine: Schema.optional(Schema.Int),
});
export const pullRequestSchema = Schema.Struct({
  ...pullRequestSummarySchema.fields,
  description: Schema.String,
  createdAt: Schema.optional(Schema.String),
  authorAvatarUrl: Schema.optional(Schema.String),
  baseBranch: Schema.String,
  headSha: Schema.String,
  headRepository: Schema.optional(Schema.String),
  mergeable: Schema.String,
  mergeMethods: Schema.optional(Schema.Array(pullRequestMergeMethodSchema)),
  labels: Schema.Array(
    Schema.Struct({ name: Schema.String, color: Schema.String }),
  ),
  checks: Schema.Array(pullCheckSchema),
  timeline: Schema.Array(pullTimelineItemSchema),
  truncated: Schema.Boolean,
});
export type PullRequest = typeof pullRequestSchema.Type;
export type PullRequestSummary = typeof pullRequestSummarySchema.Type;

export const githubPullChecksSchema = Schema.Struct({
  number: Schema.Int,
  commits: Schema.Struct({
    nodes: Schema.Array(
      Schema.Struct({
        commit: Schema.Struct({
          statusCheckRollup: Schema.NullOr(
            Schema.Struct({
              state: Schema.Literals([
                'SUCCESS',
                'PENDING',
                'EXPECTED',
                'FAILURE',
                'ERROR',
              ]),
            }),
          ),
        }),
      }),
    ),
  }),
});
export type GitHubPullChecks = typeof githubPullChecksSchema.Type;
export const pullChecksResultSchema = Schema.Literals([
  'passed',
  'running',
  'failed',
  'none',
]);
export type PullChecksResult = typeof pullChecksResultSchema.Type;

const githubStepSchema = Schema.Struct({
  number: Schema.Int,
  name: Schema.String,
  status: Schema.String,
  conclusion: Schema.optional(Schema.NullOr(Schema.String)),
  startedAt: Schema.optional(Schema.NullOr(Schema.String)),
  completedAt: Schema.optional(Schema.NullOr(Schema.String)),
});
const githubAnnotationSchema = Schema.Struct({
  annotationLevel: Schema.optional(Schema.NullOr(Schema.String)),
  message: Schema.String,
  path: Schema.optional(Schema.NullOr(Schema.String)),
  title: Schema.optional(Schema.NullOr(Schema.String)),
  location: Schema.optional(
    Schema.NullOr(
      Schema.Struct({ start: Schema.Struct({ line: Schema.Int }) }),
    ),
  ),
});
const githubStatusCheckSchema = Schema.Union([
  Schema.Struct({
    ...checkRunSchema.fields,
    databaseId: Schema.optional(Schema.NullOr(Schema.Int)),
    isRequired: Schema.optional(Schema.Boolean),
    title: Schema.optional(Schema.NullOr(Schema.String)),
    summary: Schema.optional(Schema.NullOr(Schema.String)),
    checkSuite: Schema.optional(
      Schema.NullOr(
        Schema.Struct({
          app: Schema.optional(
            Schema.NullOr(
              Schema.Struct({
                name: Schema.optional(Schema.NullOr(Schema.String)),
                slug: Schema.optional(Schema.NullOr(Schema.String)),
              }),
            ),
          ),
          workflowRun: Schema.optional(
            Schema.NullOr(
              Schema.Struct({
                databaseId: Schema.optional(Schema.NullOr(Schema.Int)),
                runNumber: Schema.optional(Schema.NullOr(Schema.Int)),
                workflow: Schema.optional(
                  Schema.NullOr(Schema.Struct({ name: Schema.String })),
                ),
              }),
            ),
          ),
        }),
      ),
    ),
    steps: Schema.optional(
      Schema.NullOr(Schema.Struct({ nodes: Schema.Array(githubStepSchema) })),
    ),
    annotations: Schema.optional(
      Schema.NullOr(
        Schema.Struct({ nodes: Schema.Array(githubAnnotationSchema) }),
      ),
    ),
  }),
  Schema.Struct({
    ...statusContextSchema.fields,
    description: Schema.optional(Schema.NullOr(Schema.String)),
    isRequired: Schema.optional(Schema.Boolean),
  }),
]);
const githubReviewerSchema = Schema.Struct({
  requestedReviewer: Schema.NullOr(
    Schema.Struct({
      login: Schema.optional(Schema.String),
      name: Schema.optional(Schema.String),
      slug: Schema.optional(Schema.String),
    }),
  ),
});
const githubStatusContextsSchema = Schema.Struct({
  ...checkContextSchema.fields,
  nodes: Schema.Array(githubStatusCheckSchema),
});
const githubStatusRollupSchema = Schema.NullOr(
  Schema.Struct({
    contexts: githubStatusContextsSchema,
    ...rollupSchema.fields,
  }),
);
const githubStatusCommitSchema = Schema.Struct({
  commit: Schema.Struct({ statusCheckRollup: githubStatusRollupSchema }),
});
const githubStatusCommitsSchema = Schema.Struct({
  nodes: Schema.Array(githubStatusCommitSchema),
});
export const githubPullStatusSchema = Schema.Struct({
  number: Schema.Int,
  state: Schema.Literals(['OPEN', 'CLOSED', 'MERGED']),
  isDraft: Schema.Boolean,
  headRefOid: Schema.String,
  mergeable: Schema.String,
  mergeStateStatus: Schema.optional(Schema.NullOr(Schema.String)),
  reviewDecision: Schema.optional(Schema.NullOr(Schema.String)),
  reviewRequests: Schema.optional(
    Schema.NullOr(Schema.Struct({ nodes: Schema.Array(githubReviewerSchema) })),
  ),
  commits: githubStatusCommitsSchema,
});
export type GitHubPullStatus = typeof githubPullStatusSchema.Type & {
  readonly viewerPermission: string | undefined;
};

const pullCheckStepSchema = Schema.Struct({
  number: Schema.Int,
  name: Schema.String,
  status: Schema.String,
  conclusion: Schema.optional(Schema.String),
  startedAt: Schema.optional(Schema.String),
  completedAt: Schema.optional(Schema.String),
});
const pullCheckAnnotationSchema = Schema.Struct({
  level: Schema.String,
  message: Schema.String,
  title: Schema.optional(Schema.String),
  path: Schema.optional(Schema.String),
  line: Schema.optional(Schema.Int),
});
const pullCheckDetailSchema = Schema.Struct({
  key: Schema.String,
  kind: Schema.Literals(['actions', 'check', 'status']),
  name: Schema.String,
  status: Schema.String,
  conclusion: Schema.optional(Schema.String),
  detailsUrl: Schema.optional(Schema.String),
  startedAt: Schema.optional(Schema.String),
  completedAt: Schema.optional(Schema.String),
  group: Schema.String,
  runId: Schema.optional(Schema.Int),
  runNumber: Schema.optional(Schema.Int),
  jobId: Schema.optional(Schema.Int),
  required: Schema.Boolean,
  summary: Schema.optional(Schema.String),
  steps: Schema.Array(pullCheckStepSchema),
  annotations: Schema.Array(pullCheckAnnotationSchema),
});
export type PullCheckDetail = typeof pullCheckDetailSchema.Type;
export const pullRequestStatusSchema = Schema.Struct({
  number: Schema.Int,
  state: Schema.Literals(['open', 'closed', 'merged']),
  draft: Schema.Boolean,
  headSha: Schema.String,
  mergeable: Schema.String,
  mergeState: Schema.optional(Schema.String),
  reviewDecision: Schema.optional(Schema.String),
  requestedReviewers: Schema.Array(Schema.String),
  canRerun: Schema.Boolean,
  checks: Schema.Array(pullCheckDetailSchema),
  checksTruncated: Schema.Boolean,
  checksSummary: Schema.optional(Schema.String),
});
export type PullRequestStatus = typeof pullRequestStatusSchema.Type;

const checkLogLineSchema = Schema.Struct({
  text: Schema.String,
  level: Schema.Literals(['plain', 'error', 'warning', 'group', 'command']),
});
export type CheckLogLine = typeof checkLogLineSchema.Type;
export const checkLogExcerptSchema = Schema.Struct({
  source: Schema.Literals(['step', 'job']),
  lines: Schema.Array(checkLogLineSchema),
  omitted: Schema.Int,
});
export type CheckLogExcerpt = typeof checkLogExcerptSchema.Type;
export const checkLogUnavailableReasonSchema = Schema.Literals([
  'gh-not-installed',
  'no-accounts',
  'no-access',
  'not-github',
  'rate-limited',
  'offline',
  'invalid-response',
  'pull-request-not-found',
  'log-missing',
  'log-too-large',
]);
export type CheckLogUnavailableReason =
  typeof checkLogUnavailableReasonSchema.Type;

export const pullRequestRerunTargetSchema = Schema.Union([
  Schema.Struct({ kind: Schema.Literal('failed-jobs'), runId: Schema.Int }),
  Schema.Struct({ kind: Schema.Literal('job'), jobId: Schema.Int }),
]);
export type PullRequestRerunTarget = typeof pullRequestRerunTargetSchema.Type;
export const pullRequestActionRefusalSchema = Schema.Literals([
  'refused',
  'head-changed',
  'not-rerunnable',
  'gh-not-installed',
  'no-accounts',
  'no-access',
  'not-github',
  'rate-limited',
  'offline',
  'invalid-response',
  'pull-request-not-found',
]);
