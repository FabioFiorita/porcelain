import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

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
  const storage = await page.evaluate(() =>
    JSON.stringify([
      localStorage,
      sessionStorage,
      document.cookie,
      location.href,
    ]),
  );
  expect(storage).not.toContain(token);
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
  await expect(page.getByText('Current session project')).toBeVisible();
  await expect(page.getByText('Old session project')).toHaveCount(0);
});
