import { expect } from 'vitest';
import { test } from '../kit/server-test.ts';

import { unknownWorktreeId, worktreeNotFound } from '../kit/answers.ts';

test('deleting an unknown worktree uses the sibling worktree failure', async ({
  session,
}) => {
  const response = await session.send({
    method: 'DELETE',
    path: `/api/worktrees/${unknownWorktreeId}/review`,
  });
  expect(response.status).toBe(404);
  expect(response.body).toEqual(worktreeNotFound);
});
