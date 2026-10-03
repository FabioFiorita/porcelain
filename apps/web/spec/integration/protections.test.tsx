import { page } from 'vitest/browser';
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

test('an assertion on a heading the feature never shows fails', async ({
  workspace,
}) => {
  await expect
    .element(
      workspace.getByRole('region', { name: 'Review content', exact: true }),
    )
    .toBeVisible();
  await expect(
    expect
      .element(
        page.getByRole('heading', {
          name: 'A heading Porcelain never shows',
          exact: true,
        }),
        { timeout: 1_000 },
      )
      .toBeVisible(),
  ).rejects.toThrow(/A heading Porcelain never shows/);
});

test('the server readers return the state the server kept, so a name nobody gave the project is never read back', async ({
  server,
}) => {
  await expect
    .poll(async () => (await server.project()).name)
    .toBe('repository');
  await expect(
    expect
      .poll(async () => (await server.project()).name, { timeout: 1_000 })
      .toBe('A name nobody gave the project'),
  ).rejects.toThrow(/A name nobody gave the project/);
});
