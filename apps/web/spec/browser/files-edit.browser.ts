import { readTextFileResponseSchema } from '@porcelain/contracts/files';
import { readInventoryResponseSchema } from '@porcelain/contracts/projects';
import { expect, test } from 'vitest';
import { page } from 'vitest/browser';

test('files.edit: editor saves paused and completed changes', async () => {
  const code: unknown = import.meta.env.VITE_WEB_FILES_EDIT_CODE;
  const environmentId: unknown = import.meta.env.VITE_WEB_ENVIRONMENT_ID;
  if (typeof code !== 'string' || typeof environmentId !== 'string')
    throw new Error('Browser verification did not issue a pairing link');
  const fragment = new URLSearchParams({ c: code, e: environmentId });
  history.replaceState({}, '', `/pair#${fragment.toString()}`);
  const root = document.createElement('div');
  root.id = 'root';
  document.body.append(root);

  await import('../../src/main.tsx');
  await expect
    .element(page.getByRole('region', { name: 'Review content' }))
    .toBeVisible();
  const inventoryResponse = await fetch('/api/inventory', {
    cache: 'no-store',
  });
  expect(inventoryResponse.status).toBe(200);
  const inventory = readInventoryResponseSchema.parse(
    await inventoryResponse.json(),
  );
  const worktreeId = inventory.projects[0]?.worktrees[0]?.id;
  if (!worktreeId) throw new Error('The isolated server has no worktree');

  await page.getByRole('button', { name: 'Review', exact: true }).click();
  await page.getByRole('tab', { name: 'Files' }).click();
  const file = page.getByRole('treeitem', { name: 'README.md' });
  await expect.element(file).toBeVisible();
  await file.click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Open file' }).click();
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  const editor = page.getByRole('textbox', { name: 'README.md' });
  await expect.element(editor).toBeVisible();

  await editor.fill('Browser autosave marker');
  await expect.element(page.getByText('Saved', { exact: true })).toBeVisible();
  const readSaved = async () => {
    const response = await fetch(
      `/api/worktrees/${encodeURIComponent(worktreeId)}/text?path=README.md`,
      { cache: 'no-store' },
    );
    expect(response.status).toBe(200);
    return readTextFileResponseSchema.parse(await response.json()).text;
  };
  expect(await readSaved()).toContain('Browser autosave marker');

  await editor.fill('Browser done marker');
  await page.getByRole('button', { name: 'Done' }).click();
  await expect
    .element(page.getByRole('button', { name: 'Edit', exact: true }))
    .toBeVisible();
  expect(await readSaved()).toContain('Browser done marker');

  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await page
    .getByRole('textbox', { name: 'README.md' })
    .fill('Browser close marker');
  await page.getByRole('button', { name: 'Close README.md' }).last().click();
  await expect.poll(readSaved).toContain('Browser close marker');
});
