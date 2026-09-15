import { readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { openNavigation } from './workspace-navigation';

test('creates, edits and renames a file, preserves conflicts, and moves it to disposable trash', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1500, height: 950 });
  await page.goto('/');
  const manifest = process.env.PORCELAIN_PLAYGROUND_INFO;
  if (!manifest) throw new Error('Missing isolated playground');
  const { tokenFile, worktreePath } = JSON.parse(
    await readFile(manifest, 'utf8'),
  ) as { tokenFile: string; worktreePath: string };
  await page.getByLabel('Access token').fill(await readFile(tokenFile, 'utf8'));
  await page.getByRole('button', { name: 'Connect', exact: true }).click();
  await openNavigation(page);
  await page.getByRole('button', { name: /^review / }).click();
  await page.getByRole('tab', { name: 'Files', exact: true }).click();
  await page.getByRole('button', { name: 'New file', exact: true }).click();
  await page.locator('[data-item-rename-input]').press('Enter');
  await expect
    .poll(() =>
      readFile(join(worktreePath, 'untitled'), 'utf8').catch(() => null),
    )
    .toBe('');
  await page.getByRole('button', { name: 'New folder', exact: true }).click();
  await page.locator('[data-item-rename-input]').press('Enter');
  await expect
    .poll(() =>
      stat(join(worktreePath, 'new-folder')).then(
        (value) => value.isDirectory(),
        () => false,
      ),
    )
    .toBe(true);
  await page.getByRole('button', { name: 'New file', exact: true }).click();
  await page.locator('[data-item-rename-input]').fill('invalid/name');
  await page.locator('[data-item-rename-input]').press('Enter');
  await expect(page.locator('[data-item-rename-input]')).toHaveCount(0);
  await expect
    .poll(() =>
      stat(join(worktreePath, 'untitled-2')).then(
        () => true,
        () => false,
      ),
    )
    .toBe(false);
  await page.getByRole('button', { name: 'New file', exact: true }).click();
  const filename = `edit-${test.info().project.name}.txt`;
  await page.locator('[data-item-rename-input]').fill(filename);
  await page.locator('[data-item-rename-input]').press('Enter');
  await expect(
    page.locator('[data-header-content]').filter({ hasText: filename }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Open diff', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: filename, exact: true }),
  ).toHaveCount(0);
  await page.screenshot({ path: test.info().outputPath('file-header.png') });
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  const editor = page.getByRole('textbox', { name: filename, exact: true });
  await expect(editor).toBeFocused();
  await editor.pressSequentially('Saved from the editor');
  await page.getByPlaceholder('Search…').fill(filename);
  await page.getByRole('treeitem').first().click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Rename', exact: true }).click();
  await page.locator('[data-item-rename-input]').fill(`blocked-${filename}`);
  await page.locator('[data-item-rename-input]').press('Enter');
  await expect(
    page.getByRole('alert').filter({ hasText: 'Finish editing this file' }),
  ).toBeVisible();
  await expect
    .poll(() =>
      stat(join(worktreePath, `blocked-${filename}`)).then(
        () => true,
        () => false,
      ),
    )
    .toBe(false);
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Edit', exact: true }),
  ).toBeVisible();
  expect(await readFile(join(worktreePath, filename), 'utf8')).toBe(
    'Saved from the editor',
  );
  await expect(
    page.getByText('Changed on disk just now', { exact: true }),
  ).toHaveCount(0);
  await writeFile(join(worktreePath, filename), 'Updated by another writer');
  await expect(
    page.getByText('Changed on disk just now', { exact: true }),
  ).toBeVisible({ timeout: 8000 });
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await expect(editor).toContainText('Updated by another writer');
  await editor.press('End');
  await editor.pressSequentially(' with a local draft');
  await writeFile(join(worktreePath, filename), Buffer.from([0, 1, 2]));
  await expect(
    page
      .getByRole('alert')
      .filter({ hasText: 'The file is no longer readable' }),
  ).toBeVisible({ timeout: 8000 });
  await expect(editor).toContainText('with a local draft');
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(
    page.getByRole('alert').filter({ hasText: 'Your draft is kept here.' }),
  ).toBeVisible();
  await expect(editor).toContainText('with a local draft');
  expect(await readFile(join(worktreePath, filename))).toEqual(
    Buffer.from([0, 1, 2]),
  );
  await expect(
    page.getByRole('button', { name: 'Copy draft', exact: true }),
  ).toBeVisible();
  await writeFile(join(worktreePath, filename), 'External change');
  await expect(
    page
      .getByRole('alert')
      .filter({ hasText: 'The file is no longer readable' }),
  ).toHaveCount(0, { timeout: 8000 });
  await page
    .getByRole('button', { name: 'Discard draft and reload', exact: true })
    .click();
  await page.getByPlaceholder('Search…').fill(filename);
  await page.getByRole('treeitem').first().click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Rename', exact: true }).click();
  const renamed = `renamed-${filename}`;
  await page.locator('[data-item-rename-input]').fill(renamed);
  await page.locator('[data-item-rename-input]').press('Enter');
  await expect
    .poll(() => readFile(join(worktreePath, renamed), 'utf8').catch(() => null))
    .toBe('External change');
  await page.getByPlaceholder('Search…').fill(renamed);
  await page.getByRole('treeitem').first().click({ button: 'right' });
  await page
    .getByRole('menuitem', { name: 'Move to trash', exact: true })
    .click();
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Move to trash', exact: true })
    .click();
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  await expect
    .poll(() =>
      readFile(join(worktreePath, renamed), 'utf8').then(
        () => 'exists',
        () => 'missing',
      ),
    )
    .toBe('missing');
});
