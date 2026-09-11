import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { openNavigation } from './workspace-navigation';

test('connects to real Git inventory, refreshes and clears the session', async ({
  page,
  request,
}) => {
  const manifest = process.env.PORCELAIN_PLAYGROUND_INFO;
  if (!manifest) throw new Error('Missing playground manifest');
  const info = JSON.parse(await readFile(manifest, 'utf8')) as {
    tokenFile: string;
  };
  const token = await readFile(info.tokenFile, 'utf8');
  const inventoryResponse = await request.get('/api/inventory', {
    headers: { authorization: `Bearer ${token}` },
  });
  expect(inventoryResponse.ok()).toBe(true);
  const inventory = await inventoryResponse.json();
  await page.goto('/');
  await page.getByLabel('Access token').fill('incorrect');
  await page.getByRole('button', { name: 'Connect', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText(
    'Access token was rejected',
  );
  await page.getByLabel('Access token').fill(token);
  await page.getByRole('button', { name: 'Connect', exact: true }).click();
  await expect(page.getByLabel('Access token')).toBeHidden();
  await openNavigation(page);
  const navigator = page.getByRole('navigation', {
    name: 'Projects and worktrees',
  });
  await expect(navigator).toBeVisible();
  for (const project of inventory.projects) {
    await expect(
      navigator.getByRole('heading', { name: project.name, exact: true }),
    ).toBeVisible();
    for (const worktree of project.worktrees) {
      await expect(
        navigator.getByRole('button').filter({ hasText: worktree.path }),
      ).toBeVisible();
    }
  }
  const review = inventory.projects[0].worktrees.find(
    (entry: { main: boolean }) => !entry.main,
  );
  await navigator.getByRole('button').filter({ hasText: review.path }).click();
  const openReview = page.getByRole('button', { name: 'Review', exact: true });
  if (await openReview.isVisible()) await openReview.click();
  await page.getByRole('tab', { name: 'Files', exact: true }).click();
  await page.getByRole('button', { name: 'README.md', exact: true }).click();
  await expect(
    page.getByRole('region', { name: 'Read-only code' }),
  ).toContainText('Porcelain');
  const feedback = `File feedback ${crypto.randomUUID()}`;
  await page.getByRole('button', { name: 'Add comment' }).click();
  await page.getByLabel('Comment', { exact: true }).fill(feedback);
  // The textarea's 3px focus ring must fit inside every clipping ancestor.
  const focusRingFits = await page
    .getByLabel('Comment', { exact: true })
    .evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      for (const ancestor of ancestorElements(element)) {
        const style = getComputedStyle(ancestor);
        if (!['auto', 'scroll', 'hidden', 'clip'].includes(style.overflowX))
          continue;
        const clip = ancestor.getBoundingClientRect();
        if (bounds.left - 3 < clip.left || bounds.right + 3 > clip.right)
          return false;
      }
      return true;
      function* ancestorElements(node: Element): Generator<Element> {
        for (
          let parent = node.parentElement;
          parent;
          parent = parent.parentElement
        )
          yield parent;
      }
    });
  expect(focusRingFits).toBe(true);
  await page.getByRole('button', { name: 'Post comment' }).click();
  await expect(page.getByText(feedback, { exact: true })).toBeVisible();
  const commentsResponse = await request.get(
    `/api/worktrees/${review.id}/comments`,
    {
      headers: { authorization: `Bearer ${token}` },
    },
  );
  expect(commentsResponse.ok()).toBe(true);
  expect(await commentsResponse.json()).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        anchor: { kind: 'file', filePath: 'README.md' },
        messages: expect.arrayContaining([
          expect.objectContaining({ body: feedback }),
        ]),
      }),
    ]),
  );
  await openNavigation(page);
  await expect(
    navigator.getByRole('button').filter({ hasText: review.path }),
  ).toHaveAttribute('aria-pressed', 'true');
  const refreshed = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/inventory/refresh') &&
      response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  expect((await refreshed).ok()).toBe(true);
  await expect(
    page.getByRole('button', { name: 'Refresh', exact: true }),
  ).toBeEnabled();
  const cookies = await page.context().cookies();
  const session = cookies.find((cookie) => cookie.name === 'porcelain_session');
  expect(session?.httpOnly).toBe(true);
  expect(session?.expires).toBeGreaterThan(Date.now() / 1000);
  expect(
    await page.evaluate(() =>
      JSON.stringify([localStorage, sessionStorage, document.cookie]),
    ),
  ).not.toContain(token);
  await page.reload();
  await expect(page.getByLabel('Access token')).toHaveCount(0);
  await openNavigation(page);
  await expect(navigator).toBeVisible();
  await page.getByRole('button', { name: 'Disconnect', exact: true }).click();
  await expect(navigator).toHaveCount(0);
  await expect(page.getByLabel('Access token')).toHaveValue('');
  await page.reload();
  await expect(page.getByLabel('Access token')).toHaveValue('');
});

test('shows empty and unavailable inventory and recovers from a failed refresh', async ({
  page,
}) => {
  const environmentId = '7fe18f78-1477-4c19-a42b-cdd42f862151';
  await page.route('**/api/inventory', (route) =>
    route.fulfill({
      json: { environmentId, projects: [] },
    }),
  );
  await page.goto('/');
  await page.getByLabel('Access token').fill('fixture-token');
  await page.getByRole('button', { name: 'Connect', exact: true }).click();
  await openNavigation(page);
  await expect(page.getByText('No projects registered')).toBeVisible();
  await page.route('**/api/inventory/refresh', (route) =>
    route.fulfill({ status: 503, body: '{}' }),
  );
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('could not complete');
  await page.unroute('**/api/inventory/refresh');
  await page.route('**/api/inventory/refresh', (route) =>
    route.fulfill({
      json: {
        environmentId,
        projects: [
          {
            id: 'fac0e50f-b019-4e46-9dd1-efcb6af7dc09',
            name: 'Missing project',
            available: false,
            worktrees: [
              {
                id: '801a8628-1cd6-4562-81a2-9c05fba76b4a',
                path: '/fixture/missing',
                main: false,
                branch: null,
                available: false,
              },
            ],
          },
        ],
      },
    }),
  );
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  const worktree = page.getByRole('button', { name: /Detached HEAD/ });
  await expect(worktree).toContainText('Unavailable');
  await worktree.click();
  await expect(page).toHaveURL(/worktree=801a8628/);
  await expect(
    page.getByRole('heading', { name: 'Detached HEAD', exact: true }),
  ).toBeVisible();
});

test('disconnect prevents a late refresh from restoring private inventory', async ({
  page,
}) => {
  const environmentId = '7fe18f78-1477-4c19-a42b-cdd42f862151';
  await page.route('**/api/inventory', (route) =>
    route.fulfill({ json: { environmentId, projects: [] } }),
  );
  await page.goto('/');
  await page.getByLabel('Access token').fill('fixture-token');
  await page.getByRole('button', { name: 'Connect', exact: true }).click();
  await openNavigation(page);
  await expect(page.getByText('No projects registered')).toBeVisible();
  let release: () => void = () => undefined;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/api/inventory/refresh', async (route) => {
    await pending;
    await route
      .fulfill({
        json: {
          environmentId,
          projects: [
            {
              id: 'fac0e50f-b019-4e46-9dd1-efcb6af7dc09',
              name: 'Old session project',
              available: true,
              worktrees: [],
            },
          ],
        },
      })
      .catch(() => {});
  });
  const started = page.waitForRequest('**/api/inventory/refresh');
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  const oldRequest = await started;
  await page.getByRole('button', { name: 'Disconnect', exact: true }).click();
  await expect(page.getByLabel('Access token')).toHaveValue('');
  await page.unroute('**/api/inventory');
  await page.route('**/api/inventory', (route) =>
    route.fulfill({
      json: {
        environmentId,
        projects: [
          {
            id: '801a8628-1cd6-4562-81a2-9c05fba76b4a',
            name: 'Current session project',
            available: true,
            worktrees: [],
          },
        ],
      },
    }),
  );
  await page.getByLabel('Access token').fill('new-fixture-token');
  await page.getByRole('button', { name: 'Connect', exact: true }).click();
  await openNavigation(page);
  await expect(page.getByText('Current session project')).toBeVisible();
  release();
  const oldResponse = await oldRequest.response();
  await oldResponse?.finished();
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      }),
  );
  await openNavigation(page);
  await expect(page.getByText('Current session project')).toBeVisible();
  await expect(page.getByText('Old session project')).toHaveCount(0);
});

test('logout in another tab prevents an existing tab from continuing with a bearer token', async ({
  page,
  context,
}) => {
  const manifest = process.env.PORCELAIN_PLAYGROUND_INFO;
  if (!manifest) throw new Error('Missing playground manifest');
  const info = JSON.parse(await readFile(manifest, 'utf8')) as {
    tokenFile: string;
  };
  const token = (await readFile(info.tokenFile, 'utf8')).trim();
  await page.goto('/');
  await page.getByLabel('Access token').fill(token);
  await page.getByRole('button', { name: 'Connect', exact: true }).click();
  await expect(page.getByLabel('Access token')).toHaveCount(0);
  const other = await context.newPage();
  await other.goto('/');
  await expect(other.getByLabel('Access token')).toHaveCount(0);
  await openNavigation(other);
  await other.getByRole('button', { name: 'Disconnect', exact: true }).click();
  await expect(other.getByLabel('Access token')).toBeVisible();
  await openNavigation(page);
  const response = page.waitForResponse('**/api/inventory/refresh');
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  expect((await response).status()).toBe(401);
  await page.reload();
  await expect(page.getByLabel('Access token')).toBeVisible();
  expect(
    (await context.cookies()).some(
      (cookie) => cookie.name === 'porcelain_session',
    ),
  ).toBe(false);
  await other.close();
});
