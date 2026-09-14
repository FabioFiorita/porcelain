import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { openNavigation } from './workspace-navigation';

test('keeps Files usable while the complete tree is slow or unavailable', async ({
  page,
}) => {
  const manifest = process.env.PORCELAIN_PLAYGROUND_INFO;
  if (!manifest) throw new Error('Missing isolated playground');
  const { tokenFile } = JSON.parse(await readFile(manifest, 'utf8')) as {
    tokenFile: string;
  };
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/file-tree', async (route) => {
    await gate;
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: '{}',
    });
  });
  try {
    await page.goto('/');
    await page
      .getByLabel('Access token')
      .fill(await readFile(tokenFile, 'utf8'));
    await page.getByRole('button', { name: 'Connect', exact: true }).click();
    await openNavigation(page);
    await page.getByRole('button', { name: /^review / }).click();
    const files = page.getByRole('tab', { name: 'Files', exact: true });
    if (!(await files.isVisible()))
      await page.getByRole('button', { name: 'Review', exact: true }).click();
    await files.click();
    await expect(
      page.getByText('Loading files…', { exact: false }),
    ).toBeVisible();
    await expect(page.getByRole('treeitem').first()).toBeVisible();
    release();
    await expect(
      page.getByText(
        'Full file search could not be loaded. You can still browse folders.',
      ),
    ).toBeVisible();
    await expect(page.getByRole('treeitem').first()).toBeVisible();
    await page.unroute('**/file-tree');
    await page.getByRole('button', { name: 'Try again', exact: true }).click();
    await expect(
      page.getByText(
        'Full file search could not be loaded. You can still browse folders.',
      ),
    ).toHaveCount(0);
    await expect(
      page.getByText('Loading files…', { exact: false }),
    ).toHaveCount(0);
  } finally {
    release();
  }
});
