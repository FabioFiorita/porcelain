import type { GitHubPullStatus } from '../../src/models/pull-request.ts';

type Raw = GitHubPullStatus;
export type RawCheck = NonNullable<
  Raw['commits']['nodes'][number]['commit']['statusCheckRollup']
>['contexts']['nodes'][number];

export function githubPullStatus(
  checks: readonly RawCheck[],
  overrides: Partial<Raw> = {},
): Raw {
  return {
    number: 57,
    state: 'OPEN',
    isDraft: false,
    headRefOid: 'a'.repeat(40),
    mergeable: 'MERGEABLE',
    mergeStateStatus: 'BLOCKED',
    reviewDecision: 'REVIEW_REQUIRED',
    reviewRequests: {
      nodes: [
        { requestedReviewer: { login: 'octo' } },
        { requestedReviewer: { slug: 'org/platform' } },
        { requestedReviewer: null },
      ],
    },
    commits: {
      nodes: [
        {
          commit: {
            statusCheckRollup: {
              state: 'FAILURE',
              contexts: { nodes: checks, pageInfo: { hasNextPage: true } },
            },
          },
        },
      ],
    },
    viewerPermission: 'WRITE',
    ...overrides,
  };
}

export const actionsJob: RawCheck = {
  __typename: 'CheckRun',
  databaseId: 61004,
  name: 'Browser tests',
  status: 'COMPLETED',
  conclusion: 'FAILURE',
  detailsUrl: 'https://github.com/o/r/actions/runs/9001/job/61004',
  startedAt: '2026-11-25T10:00:00Z',
  completedAt: '2026-11-25T10:03:00Z',
  isRequired: true,
  title: null,
  summary: null,
  checkSuite: {
    app: { name: 'GitHub Actions', slug: 'github-actions' },
    workflowRun: { databaseId: 9001, runNumber: 812, workflow: { name: 'CI' } },
  },
  steps: {
    nodes: [
      {
        number: 2,
        name: 'Run tests',
        status: 'COMPLETED',
        conclusion: 'FAILURE',
        startedAt: '2026-11-25T10:01:00Z',
        completedAt: '2026-11-25T10:03:00Z',
      },
      {
        number: 1,
        name: 'Set up job',
        status: 'COMPLETED',
        conclusion: 'SUCCESS',
        startedAt: '2026-11-25T10:00:00Z',
        completedAt: '2026-11-25T10:01:00Z',
      },
    ],
  },
  annotations: {
    nodes: [
      {
        annotationLevel: 'FAILURE',
        message: 'Process completed with exit code 1.',
        path: '.github',
        title: '',
        location: { start: { line: 1 } },
      },
    ],
  },
};

export const jobWithoutIds: RawCheck = {
  __typename: 'CheckRun',
  name: 'Lint',
  status: 'IN_PROGRESS',
  conclusion: null,
  detailsUrl: 'https://github.com/o/r/actions/runs/77/job/88',
};

export const externalChecks: readonly RawCheck[] = [
  {
    __typename: 'CheckRun',
    databaseId: 5,
    name: 'reviewdog / eslint',
    status: 'COMPLETED',
    conclusion: 'FAILURE',
    detailsUrl: 'https://reviewdog.example/runs/1',
    title: '2 problems',
    summary: 'Found in changed lines.',
    checkSuite: {
      app: { name: 'reviewdog', slug: 'reviewdog' },
      workflowRun: null,
    },
  },
  {
    __typename: 'StatusContext',
    context: 'deploy/preview',
    state: 'PENDING',
    targetUrl: null,
    description: 'Building',
  },
  {
    __typename: 'StatusContext',
    context: 'ci/legacy',
    state: 'ERROR',
    targetUrl: 'https://ci.example/1',
    isRequired: true,
  },
  {
    __typename: 'StatusContext',
    context: 'ci/required-later',
    state: 'EXPECTED',
    targetUrl: null,
  },
  {
    __typename: 'CheckRun',
    name: 'reviewdog / eslint',
    status: 'COMPLETED',
    conclusion: 'SUCCESS',
    detailsUrl: null,
    checkSuite: { app: { name: 'reviewdog', slug: 'reviewdog' } },
  },
];
