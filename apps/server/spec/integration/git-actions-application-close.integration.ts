import { expect } from 'vitest';
import { closeRunningCommit } from '../kit/application-close.ts';
import { test } from '../kit/server-test.ts';

test('closing twice while a commit hook runs stops the hook and records it interrupted before either close returns', async () => {
  const observed = await closeRunningCommit();
  expect(
    observed.hookRunningWhenSettled,
    'shutdown left the commit hook running',
  ).toBe(false);
  expect(
    observed.beforeCloseReturned,
    'a close returned before the listener finished draining',
  ).toEqual(['lan-route-closing', 'lan-route-closed']);
  expect(
    observed.closeReturned,
    'both closes return once shutdown completes',
  ).toEqual(['first-close-returned', 'second-close-returned']);
  expect(observed.headCount).toBe('1\n');
  expect(observed.restarted).toMatchObject({
    state: 'interrupted',
    reason: 'OUTCOME_UNKNOWN',
  });
});
