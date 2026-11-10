import { expect, test, type Page } from './fixtures.ts';

async function waitChanges(page: Page) {
  await expect(
    page.getByRole('heading', { name: '1 uncommitted change', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('code').filter({ hasText: 'A change to review.' }),
  ).toBeVisible();
}

async function expectNoFalseEmpty(page: Page) {
  await expect(
    page.getByText('No changes to review', { exact: true }),
  ).not.toBeAttached();
}

test('retrying a refused changes read restores the workspace at the same address', async ({
  pairedPage,
  app,
  failures,
}) => {
  failures.console(/RequestError: Request failed \(503\)/);
  await waitChanges(pairedPage);
  const address = app.address().path;
  const endOutage = await app.failChangesRead();
  await app.reload();
  const retry = pairedPage.getByRole('button', {
    name: 'Try again',
    exact: true,
  });
  await expect(retry).toBeVisible();
  await expect.poll(() => app.address().path).toBe(address);
  await endOutage();
  await retry.click();
  await waitChanges(pairedPage);
  await expect(retry).not.toBeAttached();
  await expect.poll(() => app.address().path).toBe(address);
});

test('a refused first changes read offers Retry and recovers at the same workspace address', async ({
  page,
  app,
  failures,
}) => {
  failures.console(/RequestError: Request failed \(503\)/);
  const endOutage = await app.failChangesRead();
  await app.open(await app.link('this'));
  const retry = page.getByRole('button', { name: 'Try again', exact: true });
  await expect(retry).toBeVisible();
  await expectNoFalseEmpty(page);
  const address = app.address().path;
  await endOutage();
  await retry.click();
  await waitChanges(page);
  await expect(retry).not.toBeAttached();
  await expect.poll(() => app.address().path).toBe(address);
});

test('reloading during the first changes read stays loading and opens Changes once it settles', async ({
  page,
  live,
  app,
}) => {
  const held = await live.holdChangesRead();
  held.arm();
  try {
    await app.open(await app.link('this'));
    await held.requested;
    const loading = page.getByRole('status', {
      name: 'Loading review',
      exact: true,
    });
    await expect(loading).toBeVisible();
    await expectNoFalseEmpty(page);
    const address = app.address().path;
    const reread = page.waitForRequest((request) =>
      new URL(request.url()).pathname.endsWith('/changes'),
    );
    await app.reload();
    await reread;
    await expect(loading).toBeVisible();
    await expectNoFalseEmpty(page);
    held.release();
    await waitChanges(page);
    await expect(loading).not.toBeAttached();
    await expect.poll(() => app.address().path).toBe(address);
  } finally {
    held.release();
  }
});

for (const target of ['entry', 'side']) {
  test(`an explicit file ${target} stays usable while the first changes read is held`, async ({
    page,
    live,
    app,
    repo,
  }) => {
    const held = await live.holdChangesRead();
    held.arm();
    try {
      await app.open(await app.link('this'));
      await held.requested;
      const address = app.address().path;
      const search = new URLSearchParams({
        [target]: `file:${repo.readme.path}`,
      });
      await app.open(`${address}?${search}`);
      await expect(
        page.getByRole('button', {
          name: `Close ${repo.readme.path}`,
          exact: true,
        }),
      ).toBeVisible();
      await expect
        .poll(() => new URLSearchParams(app.address().query).get(target))
        .toBe(`file:${repo.readme.path}`);
      held.release();
      const content =
        target === 'side'
          ? page.getByRole('region', { name: 'Right pane', exact: true })
          : page;
      await expect(
        content.getByText('A change to review.', { exact: true }),
      ).toBeVisible();
    } finally {
      held.release();
    }
  });
}

test('restoring an empty saved layout brings back the permanent Changes tab', async ({
  pairedPage,
  app,
}) => {
  await waitChanges(pairedPage);
  await app.restoreEmptyTabLayout();
  await app.open(app.address().path);
  await expect(
    pairedPage
      .getByRole('tablist', { name: 'Open documents', exact: true })
      .getByRole('tab', { name: 'Changes', exact: true }),
  ).toBeVisible();
  await expect(
    pairedPage.getByRole('button', { name: 'Close Changes', exact: true }),
  ).not.toBeAttached();
  await waitChanges(pairedPage);
});

test('an empty worktree opens Changes without another navigation', async ({
  page,
  app,
  repo,
}) => {
  await repo.commit('Settle the sample change');
  await app.open(await app.link('this'));
  await expect(
    page
      .getByRole('tablist', { name: 'Open documents', exact: true })
      .getByRole('tab', { name: 'Changes', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'No changes to review', exact: true }),
  ).toBeVisible();
  await expect
    .poll(() => new URLSearchParams(app.address().query).get('entry'))
    .toBeNull();
});
