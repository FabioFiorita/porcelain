import { expect, runningFailures, test } from './fixtures.tsx';

test('the automatic failures fixture collects console errors, matches declarations and reports missing declared errors', async () => {
  const failures = runningFailures();
  const reported = [
    'console error: A failure the feature never declared',
    'declared console error /a failure that never comes/ never happened',
  ];
  failures.console(/the feature declared/);
  failures.console(/a failure that never comes/);
  console.error('A failure the feature never declared');
  console.error('A failure the feature declared');
  await expect.poll(() => failures.reported()).toEqual(reported);
  failures.accept(reported);
});

test('the server reader returns the project name the server kept', async ({
  server,
}) => {
  await expect
    .poll(async () => (await server.project()).name)
    .toBe('repository');
});
