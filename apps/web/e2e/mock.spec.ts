import { expect, test } from '@playwright/test';
import { openNavigation } from './workspace-navigation';

test('develops inventory without a backend, refreshes changed fixtures and clears selection', async ({
  page,
}) => {
  const requests: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/api/')) requests.push(request.url());
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Load mock scenario' }).click();
  await openNavigation(page);
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
  await openNavigation(page);
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
  await openNavigation(page);
  await expect(page.getByText('No projects registered')).toBeVisible();
  if (await page.getByRole('dialog').isVisible())
    await page.keyboard.press('Escape');
  await page.getByLabel('Mock scenario').selectOption('refresh-failed');
  await page.getByRole('button', { name: 'Load mock scenario' }).click();
  await openNavigation(page);
  await openNavigation(page);
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('out of date');
  await expect(
    page.getByRole('heading', { name: 'Porcelain', level: 3 }),
  ).toBeVisible();
  if (await page.getByRole('dialog').isVisible())
    await page.keyboard.press('Escape');
  await page.getByLabel('Mock scenario').selectOption('unavailable');
  await page.getByRole('button', { name: 'Load mock scenario' }).click();
  await openNavigation(page);
  await expect(
    page.getByRole('button', { name: /main.*Main worktree/ }).first(),
  ).toContainText('Unavailable');
});

test('navigates project groups with the keyboard, preserves URL context and scrolls long inventory', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Load mock scenario' }).click();
  await openNavigation(page);
  const project = page.getByRole('button', { name: 'Porcelain', exact: true });
  await project.focus();
  await page.keyboard.press('Enter');
  await expect(project).toHaveAttribute('aria-expanded', 'false');
  await expect(
    page.getByRole('button', { name: /agent\/review/ }),
  ).toBeHidden();
  await page.keyboard.press('Space');
  await expect(project).toHaveAttribute('aria-expanded', 'true');
  const detached = page.getByRole('button', {
    name: /Detached HEAD.*porcelain/,
  });
  await detached.focus();
  await page.keyboard.press('Enter');
  await expect(
    page.getByRole('heading', { name: 'Detached HEAD', exact: true }),
  ).toBeVisible();
  const selectedUrl = page.url();
  await openNavigation(page);
  await expect(detached).toHaveAttribute('aria-pressed', 'true');
  const unavailable = page.getByRole('button', {
    name: /archive\/initial-prototype/,
  });
  await unavailable.click();
  await expect(page.getByRole('main')).toContainText('Unavailable');
  await page.goBack();
  await expect(page).toHaveURL(selectedUrl);
  await expect(
    page.getByRole('heading', { name: 'Detached HEAD', exact: true }),
  ).toBeVisible();
  await openNavigation(page);
  const lastProject = page.getByRole('button', {
    name: 'Archived experiments',
    exact: true,
  });
  await lastProject.scrollIntoViewIfNeeded();
  await expect(lastProject).toBeInViewport();
  await expect(
    page.getByRole('button', { name: 'Disconnect', exact: true }),
  ).toBeInViewport();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  if (await page.getByRole('dialog').isVisible())
    await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Switch to dark theme' }).click();
  await openNavigation(page);
  await expect(page.locator('html')).toHaveClass('dark');
});

test('keeps keyboard focus on visible controls when desktop navigation is collapsed', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Load mock scenario' }).click();
  await openNavigation(page);
  const toggle = page.getByRole('button', {
    name: 'Toggle Sidebar',
    exact: true,
  });
  await toggle.click();
  await page.keyboard.press('Shift+Tab');
  await expect(page.locator(':focus')).toBeInViewport();
  await toggle.click();
  await expect(
    page.getByRole('button', { name: 'Disconnect', exact: true }),
  ).toBeVisible();
});
