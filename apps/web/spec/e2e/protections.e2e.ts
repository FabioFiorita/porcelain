import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createFailures } from '../kit/failures.ts';
import { expect, test, watchFailures } from './fixtures.ts';

test('a console error the test did not declare is reported as a failure', async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext();
  const observed = await watchFailures(context);
  const page = await context.newPage();
  await page.goto(`${baseURL ?? ''}/`);
  await page.evaluate("console.error('A failure the journey never declared')");
  const failures = createFailures();
  await expect
    .poll(() => failures.unexpected(observed, []))
    .toEqual(['console error: A failure the journey never declared']);
  await context.close();
});

test('an uncaught error and an unhandled rejection in the page are reported as failures', async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext();
  const observed = await watchFailures(context);
  const page = await context.newPage();
  await page.goto(`${baseURL ?? ''}/`);
  await page.evaluate(
    "setTimeout(() => { throw new Error('An uncaught failure'); }); void Promise.reject(new Error('An unhandled rejection'));",
  );
  await expect
    .poll(() => createFailures().unexpected(observed, []).toSorted())
    .toEqual([
      'uncaught error: An uncaught failure',
      'unhandled rejection: An unhandled rejection',
    ]);
  await context.close();
});

test('a declared console error matches the one the page reports, and a declared failure that never happens is reported', async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext();
  const observed = await watchFailures(context);
  const page = await context.newPage();
  await page.goto(`${baseURL ?? ''}/`);
  await page.evaluate("console.error('A failure the journey declared')");
  const failures = createFailures();
  failures.console(/the journey declared/);
  failures.console(/a failure that never comes/);
  await expect
    .poll(() => failures.unexpected(observed, []))
    .toEqual([
      'declared console error /a failure that never comes/ never happened',
    ]);
  await context.close();
});

test('an undeclared 5xx answer from the server is reported, a declared one is not, and a kit request never counts', () => {
  const failures = createFailures();
  failures.response('POST /api/worktrees/:worktreeId/git/actions', 503);
  expect(
    failures.unexpected(
      [],
      [
        {
          method: 'POST',
          route: '/api/worktrees/:worktreeId/git/actions',
          path: '/api/worktrees/w/git/actions',
          kit: false,
          status: 503,
        },
        {
          method: 'GET',
          route: '/api/inventory',
          path: '/api/inventory',
          kit: false,
          status: 500,
        },
        {
          method: 'GET',
          route: '/api/health',
          path: '/api/health',
          kit: true,
          status: 502,
        },
      ],
    ),
  ).toEqual(['server answered GET /api/inventory with 500']);
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
  const folder = await mkdtemp(join(tmpdir(), 'porcelain-e2e-evidence-'));
  try {
    await world.keepEvidence(folder);
    const saved = [
      await readFile(join(folder, 'kit.json'), 'utf8'),
      await readFile(join(folder, 'server.json'), 'utf8'),
    ].join('\n');
    expect(saved).toContain('[redacted]');
    expect(saved).not.toContain(world.server.credential);
    expect(world.recorder.leaks(saved)).toBe(0);
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
});
