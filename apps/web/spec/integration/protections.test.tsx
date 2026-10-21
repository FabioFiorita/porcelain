import { expect, runningFailures, test } from './fixtures.tsx';

test('the automatic failures fixture reports a console error the test did not declare', async () => {
  const failures = runningFailures();
  const reported = ['console error: A failure the feature never declared'];
  console.error('A failure the feature never declared');
  await expect.poll(() => failures.reported()).toEqual(reported);
  failures.accept(reported);
});

test('the automatic failures fixture reports a declared console error that never happens', async () => {
  const failures = runningFailures();
  const reported = [
    'declared console error /a failure that never comes/ never happened',
  ];
  failures.console(/the feature declared/);
  failures.console(/a failure that never comes/);
  console.error('A failure the feature declared');
  await expect.poll(() => failures.reported()).toEqual(reported);
  failures.accept(reported);
});

test('the server readers return the project name the server kept', async ({
  server,
}) => {
  await expect
    .poll(async () => (await server.project()).name)
    .toBe('repository');
});
