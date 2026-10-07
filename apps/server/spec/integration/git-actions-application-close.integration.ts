import { expect } from 'vitest';
import { closeRunningCommit } from '../kit/application-close.ts';
import { test } from '../kit/server-test.ts';

test('closing twice while a commit hook runs stops the hook and records it interrupted before either close returns', async () => {
  const observed = await closeRunningCommit();
  expect(
    observed.duringDrain,
    'the second close returned before the first finished draining the listener',
  ).toEqual(['lan-route-closing']);
  expect(
    observed.hookRunningDuringDrain,
    'the commit hook stopped before the listener finished draining',
  ).toBe(true);
  expect(
    {
      drained: observed.drained,
      hookRunning: observed.hookRunningWhenSettled,
    },
    'stopping the workflow before closing the lanes left the commit hook running and shutdown unfinished',
  ).toEqual({ drained: 'closed', hookRunning: false });
  expect(
    observed.beforeCloseReturned,
    'the database closed before the listener finished draining',
  ).toEqual(['lan-route-closing', 'lan-route-closed', 'persistence-closed']);
  expect(
    observed.closeReturned,
    'a close returned before the database finished closing',
  ).toEqual(['first-close-returned', 'second-close-returned']);
  expect(
    observed.persistence,
    'the database closed before the commit hook had stopped and its interrupted receipt was stored',
  ).toEqual([
    {
      receipt: { state: 'interrupted', reason: 'OUTCOME_UNKNOWN' },
      hookRunning: false,
    },
  ]);
  expect(observed.headCount).toBe('1\n');
  expect(observed.restarted).toMatchObject({
    state: 'interrupted',
    reason: 'OUTCOME_UNKNOWN',
  });
});
