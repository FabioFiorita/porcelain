import { expect, it } from 'vite-plus/test';
import { mapPullStatus } from './pull-request-status.ts';
import {
  actionsJob,
  externalChecks,
  githubPullStatus as status,
  jobWithoutIds,
} from '../../spec/fixtures/github-pull-status.ts';

it('reads an Actions job with its run, ordered steps and annotations', () => {
  const mapped = mapPullStatus(status([actionsJob]));
  expect(mapped).toMatchObject({
    number: 57,
    state: 'open',
    headSha: 'a'.repeat(40),
    mergeState: 'BLOCKED',
    reviewDecision: 'REVIEW_REQUIRED',
    requestedReviewers: ['octo', 'org/platform'],
    canRerun: true,
    checksTruncated: true,
    checksSummary: 'FAILURE',
  });
  expect(mapped.checks).toEqual([
    {
      key: 'actions:9001:Browser tests',
      kind: 'actions',
      name: 'Browser tests',
      status: 'COMPLETED',
      conclusion: 'FAILURE',
      detailsUrl: 'https://github.com/o/r/actions/runs/9001/job/61004',
      startedAt: '2026-11-25T10:00:00Z',
      completedAt: '2026-11-25T10:03:00Z',
      group: 'CI',
      runId: 9001,
      jobId: 61004,
      required: true,
      summary: undefined,
      steps: [
        {
          number: 1,
          name: 'Set up job',
          status: 'COMPLETED',
          conclusion: 'SUCCESS',
          startedAt: '2026-11-25T10:00:00Z',
          completedAt: '2026-11-25T10:01:00Z',
        },
        {
          number: 2,
          name: 'Run tests',
          status: 'COMPLETED',
          conclusion: 'FAILURE',
          startedAt: '2026-11-25T10:01:00Z',
          completedAt: '2026-11-25T10:03:00Z',
        },
      ],
      annotations: [
        {
          level: 'FAILURE',
          message: 'Process completed with exit code 1.',
          title: undefined,
          path: '.github',
          line: 1,
        },
      ],
    },
  ]);
});

it('finds Actions run and job ids in the link when the read lacks them', () => {
  const [check] = mapPullStatus(status([jobWithoutIds])).checks;
  expect(check).toMatchObject({
    kind: 'actions',
    runId: 77,
    jobId: 88,
    group: 'GitHub Actions',
    required: false,
    steps: [],
    annotations: [],
  });
});

it('keeps external checks and commit statuses apart from Actions', () => {
  const mapped = mapPullStatus(
    status(externalChecks, { viewerPermission: 'READ' }),
  );
  expect(mapped.canRerun).toBe(false);
  expect(mapped.checks.map((check) => check.key)).toEqual([
    'check:reviewdog:reviewdog / eslint',
    'status:deploy/preview',
    'status:ci/legacy',
    'status:ci/required-later',
    'check:reviewdog:reviewdog / eslint#2',
  ]);
  expect(mapped.checks[3]).toMatchObject({
    status: 'PENDING',
    conclusion: undefined,
  });
  expect(mapped.checks[0]).toMatchObject({
    kind: 'check',
    group: 'reviewdog',
    runId: undefined,
    jobId: undefined,
    summary: '2 problems\n\nFound in changed lines.',
  });
  expect(mapped.checks[1]).toMatchObject({
    kind: 'status',
    status: 'PENDING',
    conclusion: undefined,
    detailsUrl: undefined,
    summary: 'Building',
  });
  expect(mapped.checks[2]).toMatchObject({
    status: 'COMPLETED',
    conclusion: 'ERROR',
    required: true,
  });
});
