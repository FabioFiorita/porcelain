import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { pairBrowser, playgroundInfo } from './playground';
import { openNavigation } from './workspace-navigation';

/**
 * Opening one folder does not disturb another, and each folder carries its own
 * menu. Nothing here waits on a repository-wide read: folders load on demand.
 */
test('leaves other folders where they were, and gives a folder its menu', async ({
  page,
}) => {
  const { worktreePath } = await playgroundInfo<{ worktreePath: string }>();
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
  await pairBrowser(page);
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
  // Folders load on demand, so a folder nobody opened has no known children
  // and nothing to compact: `db/schema/` appears once `db` is opened.
  await row(`${prefix}-db/`).click();
  const folder = row(`${prefix}-db/schema/`);
  await expect(folder).toBeVisible();
  await folder.click({ button: 'right' });
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
});
