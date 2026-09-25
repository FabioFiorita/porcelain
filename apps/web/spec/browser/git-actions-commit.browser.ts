import { listCommitsResponseSchema } from '@porcelain/contracts/changes';
import { readInventoryResponseSchema } from '@porcelain/contracts/projects';
import { expect, test } from 'vitest';
import { page } from 'vitest/browser';

test('git-actions.commit: a manual message creates a real commit', async () => {
  const code: unknown = import.meta.env.VITE_WEB_GIT_ACTIONS_COMMIT_CODE;
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

  await page.getByRole('button', { name: 'Commit', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect.element(dialog).toBeVisible();
  await dialog.getByRole('textbox', { name: 'Message' }).fill('Browser commit');
  await dialog.getByRole('button', { name: 'Commit selected files' }).click();
  await expect.element(dialog.getByText('succeeded')).toBeVisible();

  const response = await fetch(
    `/api/worktrees/${encodeURIComponent(worktreeId)}/commits`,
    { cache: 'no-store' },
  );
  expect(response.status).toBe(200);
  const commits = listCommitsResponseSchema.parse(await response.json());
  expect(commits.commits[0]?.subject).toBe('Browser commit');
});
