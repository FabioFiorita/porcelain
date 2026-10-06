import { expect, keptEvidence, runningFailures, test } from './fixtures.ts';

test('the automatic failures fixture collects console errors, matches declarations and reports missing declared errors', async ({
  unpairedPage,
}) => {
  const failures = runningFailures();
  const reported = [
    'console error: A failure the journey never declared',
    'declared console error /a failure that never comes/ never happened',
  ];
  failures.console(/the journey declared/);
  failures.console(/a failure that never comes/);
  await unpairedPage.evaluate(() => {
    console.error('A failure the journey never declared');
    console.error('A failure the journey declared');
  });
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
