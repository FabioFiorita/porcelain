import { expect, it } from 'vitest';
import { createMockStore } from '../inventory/mock';
import { createCommentsMock } from './mock';

it('does not save a delayed comment after the session is cancelled', async () => {
  const store = createMockStore();
  store.delayMs = 20;
  const controller = new AbortController();
  const project = store.inventory.projects[0];
  const worktree = project?.worktrees[0];
  if (!project || !worktree) throw new Error('Missing fixture');
  const pending = createCommentsMock(store).create({
    projectId: project.id,
    worktreeId: worktree.id,
    token: 'fixture',
    signal: controller.signal,
    input: {
      anchor: { kind: 'file', filePath: 'README.md' },
      body: 'Cancelled feedback',
    },
  });
  controller.abort();
  await expect(pending).rejects.toThrow();
  expect(store.comments).toEqual({});
});
