import { expect, it } from 'vitest';
import { createMockStore } from '../inventory/mock';
import { createCommentsMock } from './mock';

const scope = {
  projectId: 'fac0e50f-b019-4e46-9dd1-efcb6af7dc09',
  worktreeId: '629a8628-1cd6-4562-81a2-9c05fba76b4b',
};
const otherWorktreeId = '629a8628-1cd6-4562-81a2-9c05fba76b4c';
const thread = {
  id: '00000000-0000-4000-8000-000000000001',
  worktreeId: scope.worktreeId,
  anchor: { kind: 'file' as const, filePath: 'README.md' },
  resolved: false,
  messages: [
    {
      id: '00000000-0000-4000-8000-000000000002',
      body: 'Agent context',
      author: 'agent' as const,
    },
  ],
};

function request(overrides: Partial<typeof scope> = {}) {
  return {
    ...scope,
    ...overrides,
    signal: new AbortController().signal,
  };
}

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

it('replies and toggles resolution without crossing worktree comment stores', async () => {
  const store = createMockStore();
  store.comments[scope.worktreeId] = [thread];
  const comments = createCommentsMock(store);

  const [replied] = await comments.reply({
    ...request(),
    threadId: thread.id,
    input: { body: 'Reviewer follow-up' },
  });
  expect(replied?.messages).toEqual([
    thread.messages[0],
    expect.objectContaining({ body: 'Reviewer follow-up', author: 'reviewer' }),
  ]);
  expect(store.comments[otherWorktreeId]).toBeUndefined();

  const [resolved] = await comments.resolve({
    ...request(),
    threadId: thread.id,
    input: { resolved: true },
  });
  expect(resolved?.resolved).toBe(true);
  const [unresolved] = await comments.resolve({
    ...request(),
    threadId: thread.id,
    input: { resolved: false },
  });
  expect(unresolved?.resolved).toBe(false);
  expect(store.comments[otherWorktreeId]).toBeUndefined();
});

it('keeps the thread unchanged when a reply or resolution command fails', async () => {
  const store = createMockStore();
  store.comments[scope.worktreeId] = [thread];
  const comments = createCommentsMock(store);
  store.commentsFailed = true;

  await expect(
    comments.reply({
      ...request(),
      threadId: thread.id,
      input: { body: 'Should not persist' },
    }),
  ).rejects.toThrow('Comments are unavailable');
  await expect(
    comments.resolve({
      ...request(),
      threadId: thread.id,
      input: { resolved: true },
    }),
  ).rejects.toThrow('Comments are unavailable');
  expect(store.comments[scope.worktreeId]).toEqual([thread]);

  store.commentsFailed = false;
  await expect(
    comments.reply({
      ...request(),
      threadId: '00000000-0000-4000-8000-000000000099',
      input: { body: 'Unknown thread' },
    }),
  ).rejects.toThrow('no longer available');
  expect(store.comments[scope.worktreeId]).toEqual([thread]);
});
