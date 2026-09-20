import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { playgroundManifest } from './playground';
import { openNavigation } from './workspace-navigation';

test('marks immediately and rolls back when background validation rejects the file', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1500, height: 950 });
  const manifest = playgroundManifest();
  const { tokenFile } = JSON.parse(await readFile(manifest, 'utf8')) as {
    tokenFile: string;
  };
  await page.goto('/');
  await page.getByLabel('Access token').fill(await readFile(tokenFile, 'utf8'));
  await page.getByRole('button', { name: 'Connect', exact: true }).click();
  await openNavigation(page);
  await page.getByRole('button', { name: /^review / }).click();
  await page.getByRole('button', { name: /^accessibility.md/ }).click();
  const name = 'docs/accessibility.md';
  const mark = page
    .getByRole('button', { name: `Mark ${name} as reviewed`, exact: true })
    .first();
  await expect(mark).toBeVisible();
  await page.waitForLoadState('networkidle');
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let summaries = 0;
  page.on('request', (request) => {
    if (request.url().endsWith('/review-summary')) summaries++;
  });
  await page.route('**/reviewed', async (route) => {
    if (route.request().method() !== 'PUT') return route.continue();
    await gate;
    await route.fulfill({
      status: 409,
      contentType: 'application/json',
      body: JSON.stringify({
        code: 'REVIEWED_MARK_STALE',
        message: 'The reviewed mark is based on stale evidence',
      }),
    });
  });
  try {
    await mark.click();
    await expect(
      page
        .getByRole('button', {
          name: `Unmark ${name} as unreviewed`,
          exact: true,
        })
        .first(),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(summaries).toBe(0);
    release();
    await expect(mark).toHaveAttribute('aria-pressed', 'false');
    await expect(
      page
        .getByRole('alert')
        .filter({ hasText: /stale|changed/i })
        .first(),
    ).toBeVisible();
    expect(summaries).toBe(0);
  } finally {
    release();
  }
});
