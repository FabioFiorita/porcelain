import { expect, it } from 'vite-plus/test';
import {
  checkDurationLabel,
  checkLogUnavailable,
  failedJobsRerunRequest,
  jobRerunRequest,
  checkProgress,
  checkState,
  groupChecks,
  jobRerunOffer,
  failedJobsRerunOffer,
  nextPollDelay,
  pullRequestBlockers,
  rerunsStillPending,
  type PullCheck,
  type PullStatus,
} from './pull-request-checks.ts';

function job(
  name: string,
  state: 'passed' | 'failed' | 'running',
  extra: Partial<PullCheck> = {},
): PullCheck {
  return {
    key: `actions:${extra.group ?? 'CI'}:${name}`,
    kind: 'actions',
    name,
    status: state === 'running' ? 'IN_PROGRESS' : 'COMPLETED',
    conclusion: { passed: 'SUCCESS', failed: 'FAILURE', running: undefined }[
      state
    ],
    group: 'CI',
    runId: 1,
    jobId: name.length,
    required: false,
    steps: [],
    annotations: [],
    ...extra,
  };
}

function pull(
  checks: PullCheck[],
  extra: Partial<PullStatus> = {},
): PullStatus {
  return {
    number: 7,
    state: 'open',
    draft: false,
    headSha: 'a'.repeat(40),
    mergeable: 'MERGEABLE',
    mergeState: 'CLEAN',
    reviewDecision: undefined,
    requestedReviewers: [],
    canRerun: true,
    checks,
    checksTruncated: false,
    checksSummary: undefined,
    ...extra,
  };
}

it('groups by run, failed groups first, and splits each group by outcome', () => {
  const groups = groupChecks([
    job('Docs', 'passed', { group: 'Docs', runId: 2 }),
    job('Lint', 'passed'),
    job('Unit', 'failed'),
    job('Deploy', 'running', { group: 'Deploy', runId: 3 }),
    {
      ...job('reviewdog', 'failed'),
      key: 'check:reviewdog:reviewdog',
      kind: 'check',
      group: 'reviewdog',
      runId: undefined,
      jobId: undefined,
    },
    job('Lint', 'passed', { key: 'actions:CI:Lint again', runId: 4 }),
  ]);
  expect(
    groups.map((group) => [
      group.name,
      group.runId,
      group.state,
      group.failed.map((check) => check.name),
      group.running.map((check) => check.name),
      group.passed.map((check) => check.name),
    ]),
  ).toEqual([
    ['CI', 1, 'failed', ['Unit'], [], ['Lint']],
    ['reviewdog', undefined, 'failed', ['reviewdog'], [], []],
    ['Deploy', 3, 'running', [], ['Deploy'], []],
    ['Docs', 2, 'passed', [], [], ['Docs']],
    ['CI', 4, 'passed', [], [], ['Lint']],
  ]);
});

it('reports the running step as its position among the steps', () => {
  const step = (number: number, status: string, conclusion?: string) => ({
    number,
    name: `Step ${number}`,
    status,
    conclusion,
  });
  const check = job('Integration', 'running', {
    steps: [
      step(1, 'COMPLETED', 'SUCCESS'),
      step(2, 'COMPLETED', 'SKIPPED'),
      step(3, 'IN_PROGRESS'),
      step(4, 'PENDING'),
    ],
  });
  expect(checkProgress(check)).toMatchObject({
    position: 3,
    total: 4,
    step: { name: 'Step 3' },
  });
  expect(checkProgress(job('Done', 'passed'))).toBeUndefined();
  expect(checkProgress(job('Queued', 'running'))).toBeUndefined();
});

it('names what blocks a merge in plain words and links checks to their rows', () => {
  const failing = job('Browser tests', 'failed', {
    required: true,
    steps: [
      {
        number: 1,
        name: 'Set up job',
        status: 'COMPLETED',
        conclusion: 'SUCCESS',
      },
      {
        number: 6,
        name: 'Run tests',
        status: 'COMPLETED',
        conclusion: 'FAILURE',
      },
    ],
  });
  const running = job('Integration', 'running', {
    steps: [
      { number: 1, name: 'Set up', status: 'COMPLETED', conclusion: 'SUCCESS' },
      { number: 2, name: 'Run', status: 'IN_PROGRESS' },
    ],
  });
  expect(
    pullRequestBlockers(
      pull([failing, running, job('Lint', 'passed')], {
        mergeable: 'CONFLICTING',
        reviewDecision: 'REVIEW_REQUIRED',
        requestedReviewers: ['octo', 'org/platform', 'hubot'],
      }),
      'main',
    ),
  ).toEqual([
    { key: 'conflicts', tone: 'failed', text: 'Conflicts with main.' },
    {
      key: 'check:actions:CI:Browser tests',
      tone: 'failed',
      checkKey: 'actions:CI:Browser tests',
      text: 'Browser tests failed at step 6, Run tests · required.',
    },
    {
      key: 'running',
      tone: 'running',
      checkKey: 'actions:CI:Integration',
      text: 'Integration is running, step 2 of 2.',
    },
    {
      key: 'review',
      tone: 'none',
      text: 'Review required from octo, org/platform and 1 more.',
    },
  ]);
});

it('explains a draft, a branch behind its base and a bare branch rule', () => {
  expect(
    pullRequestBlockers(
      pull([], { draft: true, mergeState: 'BEHIND' }),
      'main',
    ).map((blocker) => blocker.text),
  ).toEqual([
    'Draft. Mark it ready for review on GitHub.',
    'Behind main. Update the branch before merging.',
  ]);
  expect(
    pullRequestBlockers(pull([], { mergeState: 'BLOCKED' }), 'main').map(
      (blocker) => blocker.text,
    ),
  ).toEqual(['A branch rule on GitHub blocks the merge.']);
  expect(pullRequestBlockers(pull([]), 'main')).toEqual([]);
  expect(
    pullRequestBlockers(
      pull([job('x', 'failed')], { state: 'merged' }),
      'main',
    ),
  ).toEqual([]);
});

it('polls from 20 seconds and backs off by half up to two minutes while nothing changes', () => {
  const delays: number[] = [];
  let delay: number | undefined;
  for (let poll = 0; poll < 7; poll++) {
    delay = nextPollDelay(delay, false);
    delays.push(delay);
  }
  expect(delays).toEqual([
    20_000, 30_000, 45_000, 67_500, 101_250, 120_000, 120_000,
  ]);
  expect(nextPollDelay(120_000, true)).toBe(20_000);
});

it('offers a re-run only for finished Actions jobs the account may re-run', () => {
  const failed = job('Unit', 'failed');
  const passed = job('Lint', 'passed');
  const status = pull([failed, passed]);
  expect(jobRerunOffer(status, failed)).toEqual({
    kind: 'available',
    confirm: false,
  });
  expect(jobRerunOffer(status, passed)).toEqual({
    kind: 'available',
    confirm: true,
  });
  expect(jobRerunOffer(pull([passed]), passed)).toEqual({
    kind: 'available',
    confirm: false,
  });
  expect(
    jobRerunOffer(pull([failed], { canRerun: false }), failed),
  ).toMatchObject({
    kind: 'unavailable',
    reason: 'Your GitHub account cannot re-run workflows in this repository.',
  });
  expect(
    jobRerunOffer(pull([failed, job('Deploy', 'running')]), failed),
  ).toMatchObject({
    kind: 'unavailable',
    reason: 'GitHub re-runs a workflow only after all of its jobs finish.',
  });
  const external = { ...failed, kind: 'check' as const, jobId: undefined };
  expect(jobRerunOffer(pull([external]), external)).toMatchObject({
    kind: 'unavailable',
  });
  const [group] = groupChecks(status.checks);
  expect(group && failedJobsRerunOffer(status, group)).toEqual({
    kind: 'available',
    confirm: false,
  });
  const [clean] = groupChecks([passed]);
  expect(clean && failedJobsRerunOffer(pull([passed]), clean)).toBeUndefined();
});

it('keeps a requested re-run pending until GitHub shows a new attempt or three minutes pass', () => {
  const requested = [{ key: 'actions:CI:Unit', jobId: 4, at: 1_000 }];
  const failed = pull([job('Unit', 'failed')]);
  expect(rerunsStillPending(failed, requested, 2_000)).toEqual(requested);
  expect(rerunsStillPending(failed, requested, 1_000 + 180_000)).toEqual(
    requested,
  );
  expect(rerunsStillPending(failed, requested, 1_000 + 180_001)).toEqual([]);
  expect(
    rerunsStillPending(pull([job('Unit', 'running')]), requested, 2_000),
  ).toEqual([]);
  expect(
    rerunsStillPending(
      pull([job('Unit', 'failed', { jobId: 99 })]),
      requested,
      2_000,
    ),
  ).toEqual([]);
});

it('formats durations in seconds, minutes and hours', () => {
  expect(checkDurationLabel(undefined)).toBeUndefined();
  expect(checkDurationLabel(4_000)).toBe('4s');
  expect(checkDurationLabel(108_000)).toBe('1m 48s');
  expect(checkDurationLabel(3_600_000)).toBe('1h 0m');
});

it('treats an expected status as still running', () => {
  expect(checkState({ status: 'COMPLETED', conclusion: 'EXPECTED' })).toBe(
    'running',
  );
  expect(checkState({ status: 'COMPLETED', conclusion: 'NEUTRAL' })).toBe(
    'skipped',
  );
});

it('asks to re-run only the failed Actions jobs of a workflow run', () => {
  const [group] = groupChecks([
    job('unit', 'failed', { runId: 9, group: 'CI' }),
    job('lint', 'failed', { runId: 9, group: 'CI' }),
    job('build', 'passed', { runId: 9, group: 'CI' }),
  ]);
  expect(group && failedJobsRerunRequest(group)).toEqual({
    title: 'Re-run 2 failed jobs in CI?',
    description:
      'GitHub starts a new attempt of the failed jobs and of the jobs that depend on them.',
    target: { kind: 'failed-jobs', runId: 9 },
    keys: ['actions:CI:unit', 'actions:CI:lint'],
  });
  const [external] = groupChecks([
    job('vercel', 'failed', { kind: 'check', runId: undefined }),
  ]);
  expect(external && failedJobsRerunRequest(external)).toBeUndefined();
});

it('asks to re-run one job by its id, and nothing without one', () => {
  expect(jobRerunRequest(job('unit', 'failed', { jobId: 31 }))).toMatchObject({
    title: 'Re-run unit?',
    target: { kind: 'job', jobId: 31 },
    keys: ['actions:CI:unit'],
  });
  expect(
    jobRerunRequest(job('unit', 'failed', { jobId: undefined })),
  ).toBeUndefined();
});

it('explains a missing job log in one sentence', () => {
  expect(checkLogUnavailable('log-too-large')).toBe(
    'The job log is larger than 16 MB.',
  );
  expect(checkLogUnavailable('offline')).toBe('GitHub did not return the log.');
});
