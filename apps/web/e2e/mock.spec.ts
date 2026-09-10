import { expect, type Page, test } from '@playwright/test';
import { openNavigation } from './workspace-navigation';

async function loadMockScenario(page: Page, scenario?: string) {
  await page.getByRole('button', { name: /open.*devtools/i }).click();
  await page
    .getByRole('button', { name: 'Mock environment', exact: true })
    .click();
  const panel = page.getByRole('region', { name: 'Mock development' });
  if (scenario) await panel.getByLabel('Mock scenario').selectOption(scenario);
  await panel.getByRole('button', { name: 'Load mock scenario' }).click();
  await page.getByRole('button', { name: /close.*devtools/i }).click();
  await expect(panel).toBeHidden();
}

test('develops inventory without a backend, refreshes changed fixtures and clears selection', async ({
  page,
}) => {
  const requests: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/api/')) requests.push(request.url());
  });
  await page.goto('/');
  await loadMockScenario(page);
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
  await loadMockScenario(page, 'empty');
  await openNavigation(page);
  await expect(page.getByText('No projects registered')).toBeVisible();
  if (await page.getByRole('dialog').isVisible())
    await page.keyboard.press('Escape');
  await loadMockScenario(page, 'refresh-failed');
  await openNavigation(page);
  await openNavigation(page);
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('out of date');
  await expect(
    page.getByRole('heading', { name: 'Porcelain', level: 3 }),
  ).toBeVisible();
  if (await page.getByRole('dialog').isVisible())
    await page.keyboard.press('Escape');
  await loadMockScenario(page, 'unavailable');
  await openNavigation(page);
  await expect(
    page.getByRole('button', { name: /main.*Main worktree/ }).first(),
  ).toContainText('Unavailable');
});

test('navigates project groups with the keyboard, preserves URL context and scrolls long inventory', async ({
  page,
}) => {
  await page.goto('/');
  await loadMockScenario(page);
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
  await loadMockScenario(page);
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

test('reviews files, changes, commits and artifact metadata across responsive worktree navigation', async ({
  page,
}) => {
  await page.goto('/');
  await loadMockScenario(page);
  await openNavigation(page);
  await page.getByRole('button', { name: /agent\/review/ }).click();
  const openReview = async () => {
    const trigger = page.getByRole('button', { name: 'Review', exact: true });
    if (await trigger.isVisible()) await trigger.click();
  };
  await openReview();
  await page.getByRole('button', { name: /review-panel.tsx.*staged/ }).click();
  await expect(
    page.getByRole('region', { name: 'Read-only code' }),
  ).toContainText('Choose a file');
  const diffView = page.getByRole('region', { name: 'Read-only code' });
  await expect(diffView).not.toContainText('@@');
  await expect(diffView.getByText('Old', { exact: true })).toBeVisible();
  await expect(diffView.getByText('New', { exact: true })).toBeVisible();
  await expect(
    diffView.locator('[data-change="inserted"] .th-keyword').first(),
  ).toBeVisible();
  const addedBackground = await diffView
    .locator('[data-change="inserted"]')
    .first()
    .evaluate((element) => getComputedStyle(element).backgroundColor);
  expect(addedBackground).not.toBe(
    await diffView
      .locator('[data-change="deleted"]')
      .first()
      .evaluate((element) => getComputedStyle(element).backgroundColor),
  );

  await openReview();
  await page.getByRole('tab', { name: 'Files', exact: true }).click();
  await page.getByRole('button', { name: 'src', exact: true }).click();
  await page.getByRole('button', { name: 'components', exact: true }).click();
  await page
    .getByRole('button', { name: 'review-panel.tsx', exact: true })
    .click();
  await expect(
    page.getByRole('region', { name: 'Read-only code' }),
  ).toContainText('ReviewPanelProps');
  const keyword = page
    .getByRole('region', { name: 'Read-only code' })
    .locator('.th-keyword')
    .first();
  const plain = page
    .getByRole('region', { name: 'Read-only code' })
    .locator('.th-token')
    .first();
  const lightColor = await keyword.evaluate(
    (element) => getComputedStyle(element).color,
  );
  expect(lightColor).not.toBe(
    await plain.evaluate((element) => getComputedStyle(element).color),
  );
  await page.getByRole('button', { name: 'Switch to dark theme' }).click();
  await expect
    .poll(() => keyword.evaluate((element) => getComputedStyle(element).color))
    .not.toBe(lightColor);
  await page.getByRole('button', { name: 'Switch to light theme' }).click();

  await openReview();
  await page.getByRole('tab', { name: 'History' }).click();
  await page
    .getByRole('button', { name: /Keep review context scoped/ })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Commit aaaaaaa' }),
  ).toBeVisible();
  await openReview();
  await page.getByRole('tab', { name: 'Artifacts' }).click();
  await page
    .getByRole('button', { name: /Keyboard accessibility audit/ })
    .click();
  await expect(page.getByText('Safely stored')).toBeVisible();
  await openNavigation(page);
  await page
    .getByRole('button', { name: /main.*Main worktree/ })
    .first()
    .click();
  await expect(
    page.getByRole('heading', { name: 'Keyboard accessibility audit' }),
  ).toHaveCount(0);
  await openReview();
  await expect(
    page.getByRole('tabpanel', { name: 'Changes' }).getByText('All caught up'),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test('recovers a lost Git response without repeating the in-memory commit', async ({
  page,
}) => {
  await page.goto('/');
  await loadMockScenario(page);
  await openNavigation(page);
  await page.getByRole('button', { name: /agent\/review/ }).click();
  const trigger = page.getByRole('button', { name: 'Review', exact: true });
  if (await trigger.isVisible()) await trigger.click();
  await page.getByRole('tab', { name: 'Git', exact: true }).click();
  await page.getByRole('button', { name: /^Commit Commit/ }).click();
  await page
    .getByLabel('Message', { exact: true })
    .fill('A recoverable mock commit');
  await page.getByRole('button', { name: 'Prepare action' }).click();
  await expect(
    page.getByRole('button', { name: 'Confirm commit' }),
  ).toBeDisabled();
  await page
    .getByLabel('I have reviewed the scope and paused external writers.')
    .check();
  await page.evaluate(() => {
    if (window.__PORCELAIN_MOCK__)
      window.__PORCELAIN_MOCK__.loseActionResponse = true;
  });
  await page.getByRole('button', { name: 'Confirm commit' }).click();
  await expect(
    page.getByRole('heading', { name: 'Outcome not yet confirmed' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Prepare another action' }),
  ).toHaveCount(0);
  await page.clock.install();
  const openReview = async () => {
    const button = page.getByRole('button', { name: 'Review', exact: true });
    if (await button.isVisible()) await button.click();
  };
  await openReview();
  await page.getByRole('tab', { name: 'Files', exact: true }).click();
  await page.clock.fastForward(360_000);
  await page.getByRole('tab', { name: 'Git', exact: true }).click();
  await page.getByRole('button', { name: /^Commit Commit/ }).click();
  await expect(
    page.getByRole('heading', { name: 'Outcome not yet confirmed' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Check receipt' }).click();
  await expect(page.getByRole('heading', { name: 'succeeded' })).toBeVisible();
  expect(
    await page.evaluate(() => window.__PORCELAIN_MOCK__?.actionCount),
  ).toBe(1);
});
