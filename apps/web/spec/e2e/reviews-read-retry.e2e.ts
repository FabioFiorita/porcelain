import { expect, test, type Page } from './fixtures.ts';

async function waitChanges(page: Page) {
  await expect(
    page.getByRole('heading', { name: 'Changes', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('code')).toContainText('A change to review.');
}

async function expectNoFalseEmpty(page: Page) {
  await expect(
    page.getByText('No changes to review', { exact: true }),
  ).not.toBeAttached();
  await expect(
    page.getByText('No open tabs', { exact: true }),
  ).not.toBeAttached();
}

test('retrying a refused review read restores the workspace at the same address', async ({
  pairedPage,
  app,
  failures,
}) => {
  failures.console(/RequestError: Request failed \(503\)/);
  await waitChanges(pairedPage);
  const address = app.address().path;
  const endOutage = await app.failReviewRead();
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
  const endOutage = await app.failReviewRead();
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

test('intentionally closing every document keeps the empty layout after reload', async ({
  pairedPage,
  app,
}) => {
  await waitChanges(pairedPage);
  await pairedPage
    .getByRole('button', { name: 'Close Changes', exact: true })
    .click();
  const empty = pairedPage.getByText('Nothing open', { exact: true });
  await expect(empty).toBeVisible();
  await expect
    .poll(() => new URLSearchParams(app.address().query).get('entry'))
    .toBeNull();
  await app.reload();
  await expect(empty).toBeVisible();
  await expect(
    pairedPage.getByRole('button', { name: 'Open all changes', exact: true }),
  ).toBeVisible();
  await expect(
    pairedPage.getByRole('heading', { name: 'Changes', exact: true }),
  ).not.toBeAttached();
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
      await expect(
        page.getByText('A change to review.', { exact: true }),
      ).toBeVisible();
    } finally {
      held.release();
    }
  });
}

for (const first of ['changes', 'publication'] as const) {
  test(`a published review opens after empty changes and publication settle: ${first} first`, async ({
    page,
    live,
    app,
    repo,
    agent,
  }) => {
    await repo.commit('Commit the sample change');
    await agent.publishReview('Published context', 'context');
    const held = await (first === 'changes'
      ? live.holdPublishedReviewRead()
      : live.holdChangesRead());
    held.arm();
    try {
      const settled = page.waitForResponse((response) => {
        const path = new URL(response.url()).pathname;
        return (
          response.request().method() === 'GET' &&
          path.endsWith(first === 'changes' ? '/changes' : '/review') &&
          response.status() === 200
        );
      });
      await app.open(await app.link('this'));
      await held.requested;
      await settled;
      const loading = page.getByRole('status', {
        name: 'Loading review',
        exact: true,
      });
      await expect(loading).toBeVisible();
      await expectNoFalseEmpty(page);
      await expect(
        page.getByText('Nothing open', { exact: true }),
      ).not.toBeAttached();
      held.release();
      await expect(
        page.getByRole('region', { name: 'Review walkthrough', exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole('tab', { name: 'Walkthrough', exact: true }),
      ).toBeVisible();
      await expect(loading).not.toBeAttached();
      await app.reload();
      await expect(
        page.getByRole('region', { name: 'Review walkthrough', exact: true }),
      ).toBeVisible();
    } finally {
      held.release();
    }
  });
}

async function expectClosedFile(page: Page, path: string) {
  await expect(
    page.getByRole('tablist', { name: 'Open documents', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Toggle Sidebar', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Review', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: `Close ${path}`, exact: true }),
  ).not.toBeAttached();
  await expect(
    page.getByRole('status', { name: 'Loading review', exact: true }),
  ).not.toBeAttached();
  await expect(
    page.getByRole('button', { name: 'Try again', exact: true }),
  ).not.toBeAttached();
  await expect(
    page
      .getByRole('tablist', { name: 'Open documents', exact: true })
      .getByRole('tab'),
  ).toHaveCount(0);
}

for (const target of ['entry', 'side']) {
  for (const read of ['changes', 'publication']) {
    test(`closing a cold explicit ${target} stays empty while ${read} is held and after release`, async ({
      page,
      live,
      app,
      repo,
      agent,
    }) => {
      if (read === 'publication') {
        await repo.commit('Commit the sample change');
        await agent.publishReview('Published context', 'context');
      }
      const held = await (read === 'changes'
        ? live.holdChangesRead()
        : live.holdPublishedReviewRead());
      held.arm();
      try {
        await app.open(await app.link('this'));
        await held.requested;
        const address = app.address().path;
        const search = new URLSearchParams({
          [target]: `file:${repo.readme.path}`,
        });
        await app.open(`${address}?${search}`);
        await page
          .getByRole('button', {
            name: `Close ${repo.readme.path}`,
            exact: true,
          })
          .click();
        await expectClosedFile(page, repo.readme.path);
        await expect.poll(() => app.address().query).toBe('');
        held.release();
        await expect(
          page.getByRole('button', {
            name: read === 'changes' ? 'Open all changes' : 'Open review',
            exact: true,
          }),
        ).toBeVisible();
        await expect(
          page.getByText('Nothing open', { exact: true }),
        ).toBeVisible();
        await expectClosedFile(page, repo.readme.path);
        await app.reload();
        await expect(
          page.getByText('Nothing open', { exact: true }),
        ).toBeVisible();
        await expectClosedFile(page, repo.readme.path);
      } finally {
        held.release();
      }
    });

    test(`closing a cold explicit ${target} stays usable while ${read} fails and after recovery`, async ({
      page,
      live,
      app,
      repo,
      agent,
      failures,
    }) => {
      failures.console(/RequestError: Request failed \(503\)/);
      if (read === 'publication') {
        await repo.commit('Commit the sample change');
        await agent.publishReview('Published context', 'context');
      }
      const restore = await (read === 'changes'
        ? live.failChangesRead()
        : live.failPublishedReviewRead());
      const ending = read === 'changes' ? '/changes' : '/review';
      try {
        const refused = page.waitForResponse(
          (response) =>
            new URL(response.url()).pathname.endsWith(ending) &&
            response.status() === 503,
        );
        await app.open(await app.link('this'));
        await refused;
        const address = app.address().path;
        const search = new URLSearchParams({
          [target]: `file:${repo.readme.path}`,
        });
        const explicitRefused = page.waitForResponse(
          (response) =>
            new URL(response.url()).pathname.endsWith(ending) &&
            response.status() === 503,
        );
        await app.open(`${address}?${search}`);
        await explicitRefused;
        await page
          .getByRole('button', {
            name: `Close ${repo.readme.path}`,
            exact: true,
          })
          .click();
        await expectClosedFile(page, repo.readme.path);
        await expect.poll(() => app.address().query).toBe('');
        await app.reload();
        await expectClosedFile(page, repo.readme.path);
        await restore();
        await app.reload();
        await expect(
          page.getByRole('button', {
            name: read === 'changes' ? 'Open all changes' : 'Open review',
            exact: true,
          }),
        ).toBeVisible();
        await expect(
          page.getByText('Nothing open', { exact: true }),
        ).toBeVisible();
        await expectClosedFile(page, repo.readme.path);
        await expect.poll(() => app.address().path).toBe(address);
      } finally {
        await restore();
      }
    });
  }
}
