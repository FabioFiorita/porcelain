import { expect, test } from '@playwright/test';

test('develops inventory without a backend, refreshes changed fixtures and clears selection', async ({
  page,
}) => {
  const requests: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/api/')) requests.push(request.url());
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Load mock scenario' }).click();
  await page.getByRole('button', { name: /agent\/review/ }).click();
  await expect(page).toHaveURL(/worktree=/);
  await expect(
    page.getByRole('heading', { name: 'agent/review' }),
  ).toBeVisible();
  await page.evaluate(() => {
    const store = window.__PORCELAIN_MOCK__;
    if (store?.inventory.projects[0])
      store.inventory.projects[0].name = 'Updated sample';
  });
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Updated sample' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Disconnect', exact: true }).click();
  await expect(page.getByLabel('Access token')).toHaveValue('');
  await expect(page).not.toHaveURL(/worktree=/);
  expect(requests).toEqual([]);
});

test('switches scenarios and preserves stale inventory on refresh failure', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByLabel('Mock scenario').selectOption('empty');
  await page.getByRole('button', { name: 'Load mock scenario' }).click();
  await expect(page.getByText('No projects registered')).toBeVisible();
  await page.getByLabel('Mock scenario').selectOption('refresh-failed');
  await page.getByRole('button', { name: 'Load mock scenario' }).click();
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('out of date');
  await expect(
    page.getByRole('heading', { name: 'Sample project' }),
  ).toBeVisible();
  await page.getByLabel('Mock scenario').selectOption('unavailable');
  await page.getByRole('button', { name: 'Load mock scenario' }).click();
  await expect(
    page.getByRole('button', { name: /main · main worktree/ }),
  ).toContainText('Unavailable');
});
