import { editFileResponseSchema } from '@porcelain/contracts/files';
import { readInventoryResponseSchema } from '@porcelain/contracts/projects';
import { expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { isContentChangedError } from '../../src/features/review/queries/review';
import { RequestError, requestJson } from '../../src/shared/api/request';
import { browserTransport } from '../../src/shared/api/transport';

test('files.conflict: the browser receives a stable changed-file code', async () => {
  const code: unknown = import.meta.env.VITE_WEB_FILES_CONFLICT_CODE;
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

  let failure: unknown;
  try {
    await requestJson(
      browserTransport(fetch),
      `/api/worktrees/${encodeURIComponent(worktreeId)}/files`,
      editFileResponseSchema,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          kind: 'write',
          path: 'README.md',
          text: 'Outdated edit\n',
          expectedFingerprint: '0'.repeat(64),
        }),
      },
    );
  } catch (error) {
    failure = error;
  }
  expect(failure).toBeInstanceOf(RequestError);
  if (!(failure instanceof RequestError))
    throw new Error('The browser did not receive a request error');
  expect(failure.status).toBe(409);
  expect(failure.code).toBe('content_changed');
  expect(isContentChangedError(failure)).toBe(true);
});
