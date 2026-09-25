import { readInventoryResponseSchema } from '@porcelain/contracts/projects';
import { listReviewedFilesResponseSchema } from '@porcelain/contracts/reviews';
import { expect, test } from 'vitest';
import { page } from 'vitest/browser';

test('review.mark: a reviewed file remains marked on the server', async () => {
  const code: unknown = import.meta.env.VITE_WEB_REVIEW_MARK_CODE;
  const environmentId: unknown = import.meta.env.VITE_WEB_ENVIRONMENT_ID;
  if (typeof code !== 'string' || typeof environmentId !== 'string')
    throw new Error('Browser verification did not issue a pairing link');
  const fragment = new URLSearchParams({ c: code, e: environmentId });
  history.replaceState({}, '', `/pair#${fragment.toString()}`);
  const root = document.createElement('div');
  root.id = 'root';
  document.body.append(root);

  await import('../../src/main.tsx');
  const mark = page.getByRole('button', {
    name: 'Mark README.md as reviewed',
  });
  await expect.element(mark).toBeVisible();
  await mark.click();
  const unmark = page.getByRole('button', {
    name: 'Unmark README.md as unreviewed',
  });
  await expect.element(unmark).toBeEnabled();

  const inventoryResponse = await fetch('/api/inventory', {
    cache: 'no-store',
  });
  expect(inventoryResponse.status).toBe(200);
  const inventory = readInventoryResponseSchema.parse(
    await inventoryResponse.json(),
  );
  const worktreeId = inventory.projects[0]?.worktrees[0]?.id;
  if (!worktreeId) throw new Error('The isolated server has no worktree');
  const reviewedResponse = await fetch(
    `/api/worktrees/${encodeURIComponent(worktreeId)}/reviewed`,
    { cache: 'no-store' },
  );
  expect(reviewedResponse.status).toBe(200);
  const reviewed = listReviewedFilesResponseSchema.parse(
    await reviewedResponse.json(),
  );
  expect(reviewed.marks.some((entry) => entry.path === 'README.md')).toBe(true);

  await unmark.click();
  await expect.element(mark).toBeEnabled();
  const clearedResponse = await fetch(
    `/api/worktrees/${encodeURIComponent(worktreeId)}/reviewed`,
    { cache: 'no-store' },
  );
  expect(clearedResponse.status).toBe(200);
  const cleared = listReviewedFilesResponseSchema.parse(
    await clearedResponse.json(),
  );
  expect(cleared.marks.some((entry) => entry.path === 'README.md')).toBe(false);
});
