import { expect, it } from 'vite-plus/test';
import type { PullCheck } from '@porcelain/client/projects/rules';
import { checkRowDetail, stepDetail, stepHasLog } from './pull-request-checks';

const start = '2026-11-25T10:00:00Z';
const now = Date.parse('2026-11-25T10:03:44Z');

function check(extra: Partial<PullCheck>): PullCheck {
  return {
    key: 'actions:CI:Browser tests',
    kind: 'actions',
    name: 'Browser tests',
    status: 'COMPLETED',
    conclusion: 'SUCCESS',
    group: 'CI',
    runId: 9001,
    jobId: 4,
    required: false,
    steps: [],
    annotations: [],
    startedAt: start,
    completedAt: '2026-11-25T10:03:44Z',
    ...extra,
  };
}

it('names the failing step and the time a failed check took', () => {
  expect(
    checkRowDetail(
      check({
        conclusion: 'FAILURE',
        required: true,
        steps: [
          {
            number: 5,
            name: 'Checkout',
            status: 'COMPLETED',
            conclusion: 'SUCCESS',
          },
          {
            number: 6,
            name: 'Run pnpm test:browser',
            status: 'COMPLETED',
            conclusion: 'FAILURE',
          },
        ],
      }),
      false,
      now,
    ),
  ).toBe('Required · Step 6 · Run pnpm test:browser · 3m 44s');
});

it('shows progress of a running check and a queued one', () => {
  const running = check({
    status: 'IN_PROGRESS',
    conclusion: undefined,
    completedAt: undefined,
    steps: [
      {
        number: 1,
        name: 'Set up job',
        status: 'COMPLETED',
        conclusion: 'SUCCESS',
      },
      { number: 2, name: 'Run tests', status: 'IN_PROGRESS' },
      { number: 3, name: 'Upload', status: 'QUEUED' },
    ],
  });
  expect(checkRowDetail(running, false, now)).toBe(
    'Step 2 of 3 · Run tests · 3m 44s',
  );
  expect(checkRowDetail({ ...running, steps: [] }, false, now)).toBe('Queued');
});

it('says a re-run was requested before GitHub reports it running', () => {
  expect(checkRowDetail(check({ conclusion: 'FAILURE' }), true, now)).toBe(
    'Re-run requested',
  );
});

it('offers a log only for finished steps', () => {
  const step = { number: 2, name: 'Run tests', startedAt: start };
  expect(
    stepHasLog({ ...step, status: 'COMPLETED', conclusion: 'FAILURE' }),
  ).toBe(true);
  expect(stepHasLog({ ...step, status: 'IN_PROGRESS' })).toBe(false);
  expect(stepDetail({ ...step, status: 'IN_PROGRESS' }, now)).toBe(
    'running 3m 44s',
  );
});
