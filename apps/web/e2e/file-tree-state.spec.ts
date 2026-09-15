import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { openNavigation } from './workspace-navigation';

test('keeps unrelated roots closed during loading and uses compact folder menus', async ({
  page,
}) => {
  const info = process.env.PORCELAIN_PLAYGROUND_INFO;
  if (!info) throw new Error('Missing isolated playground');
  const { tokenFile, worktreePath } = JSON.parse(await readFile(info, 'utf8'));
  const prefix = test.info().project.name;
  const alpha = `${prefix}-alpha`;
  const beta = `${prefix}-beta`;
  for (const path of [
    `${alpha}/nested/one.ts`,
    `${alpha}/other.ts`,
    `${beta}/two.ts`,
    `${prefix}-db/schema/table.sql`,
  ]) {
    await mkdir(join(worktreePath, path, '..'), { recursive: true });
    await writeFile(join(worktreePath, path), 'fixture');
  }
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/file-tree', async (route) => {
    await gate;
    await route.continue();
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
    const row = (path: string) =>
      page.locator(`[role="treeitem"][data-item-path="${path}"]`);
    await row(`${alpha}/`).click();
    await row(`${alpha}/nested/`).click();
    await expect(row(`${alpha}/nested/one.ts`)).toBeVisible();
    await row(`${alpha}/`).click();
    await expect(row(`${alpha}/`)).toHaveAttribute('aria-expanded', 'false');
    await row(`${beta}/`).click();
    await expect(row(`${beta}/two.ts`)).toBeVisible();
    await expect(row(`${alpha}/`)).toHaveAttribute('aria-expanded', 'false');
    release();
    await expect(
      page.getByText('Loading files…', { exact: false }),
    ).toHaveCount(0);
    await expect(row(`${alpha}/`)).toHaveAttribute('aria-expanded', 'false');
    const compact = row(`${prefix}-db/schema/`);
    await expect(compact).toBeVisible();
    await compact.click({ button: 'right' });
    const menu = page.getByRole('menu');
    await expect(menu.getByRole('menuitem')).toHaveText([
      'New file',
      'New folder',
      'Rename',
      'Hide folder',
      'Copy relative path',
      'Copy full path',
      'Move to trash',
    ]);
    for (const theme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: theme });
      await page.screenshot({
        path: test.info().outputPath(`files-${theme}.png`),
      });
    }
  } finally {
    release();
  }
});
