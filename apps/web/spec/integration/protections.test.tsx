import { page } from 'vitest/browser';
import { createFailures } from '../kit/failures.ts';
import { expect, takeObserved, test } from './fixtures.tsx';

test('a console error the test did not declare is reported as a failure', async () => {
  console.error('A failure the feature never declared');
  const observed = takeObserved();
  await expect
    .poll(() => createFailures().unexpected(observed, []))
    .toEqual(['console error: A failure the feature never declared']);
});

test('a declared console error that never happens is reported as a failure', async () => {
  const failures = createFailures();
  failures.console(/a failure that never comes/);
  await expect
    .poll(() => failures.unexpected(takeObserved(), []))
    .toEqual([
      'declared console error /a failure that never comes/ never happened',
    ]);
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
