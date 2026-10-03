import { createFailures } from '../kit/failures.ts';
import { expect, keptEvidence, runningFailures, test } from './fixtures.ts';

test('the automatic failures fixture reports a console error the test did not declare', async ({
  unpairedPage,
}) => {
  const failures = runningFailures();
  const reported = ['console error: A failure the journey never declared'];
  await unpairedPage.evaluate(() =>
    console.error('A failure the journey never declared'),
  );
  await expect.poll(() => failures.reported()).toEqual(reported);
  failures.accept(reported);
});

test('the automatic failures fixture reports an uncaught error and an unhandled rejection in the page', async ({
  unpairedPage,
}) => {
  const failures = runningFailures();
  const reported = [
    'uncaught error: An uncaught failure',
    'uncaught error: An unhandled rejection',
  ];
  await unpairedPage.evaluate(() => {
    queueMicrotask(() => {
      throw new Error('An uncaught failure');
    });
    void Promise.reject(new Error('An unhandled rejection'));
  });
  await expect
    .poll(async () => [...(await failures.reported())].sort())
    .toEqual(reported);
  failures.accept(reported);
});

test('the automatic failures fixture matches a declared console error and reports a declared one that never happens', async ({
  unpairedPage,
}) => {
  const failures = runningFailures();
  const reported = [
    'declared console error /a failure that never comes/ never happened',
  ];
  failures.console(/the journey declared/);
  failures.console(/a failure that never comes/);
  await unpairedPage.evaluate(() =>
    console.error('A failure the journey declared'),
  );
  await expect.poll(() => failures.reported()).toEqual(reported);
  failures.accept(reported);
});

test('an undeclared 5xx answer from the server is reported, a declared one is not, and a kit request never counts', async () => {
  const failures = createFailures();
  failures.response('POST /probe/actions', 503);
  await expect
    .poll(() =>
      failures.unexpected(
        [],
        [
          {
            method: 'POST',
            route: '/probe/actions',
            path: '/probe/actions',
            kit: false,
            status: 503,
          },
          {
            method: 'GET',
            route: '/probe/inventory',
            path: '/probe/inventory',
            kit: false,
            status: 500,
          },
          {
            method: 'GET',
            route: '/probe/health',
            path: '/probe/health',
            kit: true,
            status: 502,
          },
        ],
      ),
    )
    .toEqual(['server answered GET /probe/inventory with 500']);
});

test('an assertion on a heading the app never shows fails', async ({
  unpairedPage,
}) => {
  await expect(
    expect(
      unpairedPage.getByRole('heading', {
        name: 'A heading Porcelain never shows',
        exact: true,
      }),
    ).toBeVisible({ timeout: 1_000 }),
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

test('the evidence a test keeps holds no credential or pairing code', async ({
  pairedPage,
  world,
}) => {
  await expect(
    pairedPage.getByRole('region', { name: 'Review content', exact: true }),
  ).toBeVisible();
  const saved = await keptEvidence(world);
  await expect.poll(() => saved).toContain('[redacted]');
  await expect.poll(() => saved).not.toContain(world.server.credential);
  await expect.poll(() => world.recorder.leaks(saved)).toBe(0);
});
