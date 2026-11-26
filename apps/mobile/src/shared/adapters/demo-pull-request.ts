import { Schema } from 'effect';
import {
  commentOnPullRequestResponseSchema,
  listPullRequestsResponseSchema,
  mergePullRequestResponseSchema,
  readCheckLogResponseSchema,
  readPullChecksResponseSchema,
  readPullRequestResponseSchema,
  readPullStatusResponseSchema,
  rerunPullChecksResponseSchema,
  type ReadPullRequestResponse,
  type ReadPullStatusResponse,
} from '@porcelain/contracts/projects';
import { demoBranch, demoHead, demoProjectId, demoTime } from './demo-data';

type Pull = Extract<
  ReadPullRequestResponse,
  { kind: 'available' }
>['pullRequest'];
type Status = Extract<ReadPullStatusResponse, { kind: 'available' }>['status'];
type Check = Status['checks'][number];

export const demoPullRequestNumber = 7;
const number = demoPullRequestNumber;
export const demoPullRequestUrl = `https://github.com/porcelain-demo/hello-garden/pull/${number}`;
const url = demoPullRequestUrl;
const run = `https://github.com/porcelain-demo/hello-garden/actions/runs/101`;

function conclusion(step: number, failedAt: number | undefined) {
  if (failedAt === undefined || step < failedAt) return 'SUCCESS';
  return step === failedAt ? 'FAILURE' : 'SKIPPED';
}

const steps = (failedAt: number | undefined): Check['steps'] =>
  ['Set up job', 'Checkout', 'Run lint', 'Complete job'].map((name, index) => ({
    number: index + 1,
    name,
    status: 'COMPLETED',
    conclusion: conclusion(index + 1, failedAt),
    startedAt: demoTime,
    completedAt: '2026-01-01T12:00:41.000Z',
  }));

const job = (name: string, jobId: number, failed: boolean): Check => ({
  key: `actions:CI:${name}`,
  kind: 'actions',
  name,
  status: 'COMPLETED',
  conclusion: failed ? 'FAILURE' : 'SUCCESS',
  detailsUrl: `${run}/job/${jobId}`,
  startedAt: demoTime,
  completedAt: '2026-01-01T12:00:41.000Z',
  group: 'CI',
  runId: 101,
  jobId,
  required: true,
  steps: steps(failed ? 3 : undefined),
  annotations: failed
    ? [
        {
          level: 'FAILURE',
          message: 'Unexpected any. Specify a different type.',
          path: 'src/welcome.ts',
          line: 1,
        },
      ]
    : [],
});

const preview: Check = {
  key: 'status:docs-preview',
  kind: 'status',
  name: 'docs-preview',
  status: 'COMPLETED',
  conclusion: 'SUCCESS',
  detailsUrl: 'https://example.com/hello-garden/preview/7',
  group: 'Statuses',
  required: false,
  summary: 'Preview deployed.',
  steps: [],
  annotations: [],
};

const lintLog = [
  { text: '> hello-garden@1.0.0 lint', level: 'command' as const },
  { text: '> eslint src', level: 'command' as const },
  { text: '', level: 'plain' as const },
  { text: '/demo/hello-garden/src/welcome.ts', level: 'plain' as const },
  {
    text: '  1:33  error  Unexpected any. Specify a different type',
    level: 'error' as const,
  },
  { text: '', level: 'plain' as const },
  { text: '✖ 1 problem (1 error, 0 warnings)', level: 'error' as const },
  {
    text: 'Process completed with exit code 1.',
    level: 'error' as const,
  },
];

export function demoPullRequests() {
  let state: Status['state'] = 'open';
  let lintFailed = true;
  let timeline: Pull['timeline'] = [
    {
      id: 'review-1',
      kind: 'review',
      author: 'garden-reviewer',
      time: demoTime,
      body: 'Looks good once lint passes.',
      url: `${url}#pullrequestreview-1`,
      reviewState: 'COMMENTED',
    },
    {
      id: 'review-comment-1',
      kind: 'review-comment',
      author: 'garden-reviewer',
      time: demoTime,
      body: 'Should a blank name fall back to `friend`?',
      url: `${url}#discussion_r1`,
      reviewId: 'review-1',
      path: 'src/welcome.ts',
      line: 3,
      diffHunk:
        '@@ -1,3 +1,4 @@\n export function welcome(name: string) {\n-  return `Hello, ${name}!`;\n+  const trimmed = name.trim();\n+  return `Hello, ${trimmed || "friend"}!`;',
    },
  ];
  const checks = () => [
    job('Unit tests', 201, false),
    job('Lint', lintFailed ? 202 : 203, lintFailed),
    preview,
  ];
  const status = (): Status => ({
    number,
    state,
    draft: false,
    headSha: demoHead,
    mergeable: state === 'open' ? 'MERGEABLE' : 'UNKNOWN',
    mergeState: lintFailed ? 'BLOCKED' : 'CLEAN',
    reviewDecision: undefined,
    requestedReviewers: [],
    canRerun: true,
    checks: checks(),
    checksTruncated: false,
    checksSummary: lintFailed ? 'FAILURE' : 'SUCCESS',
  });
  const summary = () => ({
    number,
    title: 'A warmer welcome for every visitor',
    url,
    state,
    draft: false,
    author: 'garden-agent',
    headBranch: demoBranch,
    baseBranch: 'main',
    updatedAt: demoTime,
    checksSummary: status().checksSummary,
    checksTruncated: false,
  });
  const pull = (): Pull => ({
    ...summary(),
    description:
      '## What changed\n\n- Trim the visitor’s name before greeting them.\n- Greet a blank name as **friend**.\n\nThis is the bundled demo; nothing here reaches GitHub.',
    createdAt: demoTime,
    headSha: demoHead,
    mergeable: status().mergeable,
    mergeMethods: ['squash', 'merge'],
    labels: [{ name: 'demo', color: '0e8a16' }],
    checks: checks().map((check) => ({
      name: check.name,
      status: check.status,
      conclusion: check.conclusion,
      detailsUrl: check.detailsUrl,
    })),
    timeline,
    truncated: false,
  });
  const json = <A, I>(schema: Schema.Codec<A, I>, value: A) =>
    new Response(JSON.stringify(Schema.encodeSync(schema)(value)), {
      headers: { 'content-type': 'application/json' },
    });
  const project = `/api/projects/${demoProjectId}/pull-requests`;
  const pullPath = `${project}/${number}`;

  return (
    path: string,
    method: string,
    body: unknown,
  ): Response | undefined => {
    if (path === project)
      return json(listPullRequestsResponseSchema, {
        kind: 'available',
        account: 'demo',
        pullRequests: [summary()],
        truncated: false,
        recentlyClosedSince: demoTime,
      });
    if (path === pullPath)
      return json(readPullRequestResponseSchema, {
        kind: 'available',
        account: 'demo',
        pullRequest: pull(),
      });
    if (path === `${pullPath}/status`)
      return json(readPullStatusResponseSchema, {
        kind: 'available',
        status: status(),
      });
    if (path === `${pullPath}/checks`)
      return json(readPullChecksResponseSchema, {
        kind: 'available',
        number,
        checks: lintFailed ? 'failed' : 'passed',
      });
    if (path.startsWith(`${pullPath}/jobs/`) && path.endsWith('/log'))
      return json(readCheckLogResponseSchema, {
        kind: 'available',
        excerpt: {
          source: 'step',
          lines: path.includes('/202/')
            ? lintLog
            : [{ text: 'Done.', level: 'plain' }],
          omitted: 0,
        },
      });
    if (path === `${pullPath}/rerun` && method === 'POST') {
      lintFailed = false;
      return json(rerunPullChecksResponseSchema, { requested: true });
    }
    if (path === `${pullPath}/merge` && method === 'POST') {
      state = 'merged';
      return json(mergePullRequestResponseSchema, { merged: true });
    }
    if (path === `${pullPath}/comments` && method === 'POST') {
      const { body: text } = Schema.decodeUnknownSync(
        Schema.Struct({ body: Schema.String }),
      )(body);
      timeline = [
        ...timeline,
        {
          id: `comment-${timeline.length}`,
          kind: 'comment',
          author: 'you',
          time: demoTime,
          body: text,
          url: `${url}#issuecomment-${timeline.length}`,
        },
      ];
      return json(commentOnPullRequestResponseSchema, { url });
    }
    return undefined;
  };
}
