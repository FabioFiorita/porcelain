import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { pairBrowser, playgroundInfo } from './playground';
import { openNavigation } from './workspace-navigation';

test('reviews published behavior, navigates its graph, and invalidates a mark after code changes', async ({
  page,
}, testInfo) => {
  await pairBrowser(page);
  await openNavigation(page);
  await page.getByRole('button', { name: /^review / }).click();
  const review = page.getByRole('region', { name: 'Published review' });
  await expect(review).toBeVisible();
  const summary = page.frameLocator('iframe[title="Review summary"]');
  await expect(
    summary.getByRole('heading', { name: 'Fieldnotes launch review' }),
  ).toBeVisible();
  const isolation = await summary.locator('html').evaluate(async () => {
    let parentBlocked = false;
    let storageBlocked = false;
    try {
      void parent.document.body;
    } catch {
      parentBlocked = true;
    }
    try {
      void localStorage.length;
    } catch {
      storageBlocked = true;
    }
    let apiReadable = false;
    try {
      apiReadable = (await fetch('/api/inventory', { credentials: 'include' }))
        .ok;
    } catch {
      /* Opaque-origin API reads are blocked. */
    }
    return { parentBlocked, storageBlocked, apiReadable };
  });
  expect(isolation).toEqual({
    parentBlocked: true,
    storageBlocked: true,
    apiReadable: false,
  });
  for (const theme of ['dark', 'light']) {
    await page.emulateMedia({
      colorScheme: theme === 'dark' ? 'light' : 'dark',
    });
    await page.evaluate((value) => {
      localStorage.setItem(
        'porcelain.prototype.preferences',
        JSON.stringify({ appearance: value }),
      );
    }, theme);
    await page.reload();
    await expect(summary.locator('html')).toHaveAttribute('data-theme', theme);
    expect(
      await summary
        .locator('html')
        .evaluate((element) =>
          getComputedStyle(element)
            .getPropertyValue('--porcelain-background')
            .trim(),
        ),
    ).toBe(theme === 'dark' ? '#111' : '#fff');
    await page.screenshot({ path: testInfo.outputPath(`review-${theme}.png`) });
  }
  await review.getByRole('tab', { name: 'Graph', exact: true }).click();
  await review.getByRole('tab', { name: 'Before', exact: true }).click();
  await expect(review.getByText('Launch notes', { exact: true })).toBeVisible();
  await review.getByRole('tab', { name: 'After', exact: true }).click();
  await review
    .getByRole('button', { name: 'Release checklist', exact: true })
    .press('Enter');
  await expect(
    page.getByRole('region', {
      name: 'Review layer Prepare release documentation',
    }),
  ).toBeVisible();
  await page
    .getByRole('tab', { name: 'Review Close Review', exact: true })
    .click();
  await review.getByRole('tab', { name: 'Summary', exact: true }).click();
  await summary
    .getByRole('link', { name: 'Prepare release documentation' })
    .click();
  const layer = page.getByRole('region', {
    name: 'Review layer Prepare release documentation',
  });
  await expect(layer).toBeVisible();
  const step = layer.getByRole('article', {
    name: 'Step Accessibility checks',
  });
  await expect(step.locator('diffs-container')).toBeVisible();
  await layer.getByRole('tab', { name: 'Graph', exact: true }).click();
  await layer
    .getByRole('button', { name: 'Accessibility checks', exact: true })
    .press('Enter');
  await expect(
    layer.getByRole('tab', { name: 'Graph', exact: true }),
  ).toHaveAttribute('aria-selected', 'true');
  const codePane = layer.getByRole('region', { name: 'Selected step code' });
  await expect(
    codePane.getByRole('heading', { name: 'Accessibility checks' }),
  ).toBeVisible();
  await expect(codePane.locator('diffs-container')).toBeVisible();
  await expect(
    layer.getByRole('button', { name: 'Accessibility checks', exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('layer-graph-code.png') });
  await layer
    .getByRole('button', { name: 'Mark layer reviewed', exact: true })
    .click();
  await expect(
    layer.getByRole('button', { name: 'Reviewed', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  const { worktreePath } = await playgroundInfo<{ worktreePath: string }>();
  const path = join(worktreePath, 'docs/accessibility.md');
  const original = await readFile(path, 'utf8');
  try {
    await writeFile(
      path,
      original.replace(/[^\n]+/, '# Changed accessibility checks'),
    );
    await expect(
      layer.getByRole('button', { name: 'Mark changed layer reviewed' }),
    ).toHaveAttribute('aria-pressed', 'false');
    await expect(
      step.getByText('Code changed since the review was written.'),
    ).toBeVisible();
  } finally {
    await writeFile(path, original);
  }
});
