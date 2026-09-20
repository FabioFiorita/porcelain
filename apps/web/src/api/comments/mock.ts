import { ConnectionError } from '@porcelain/client/errors/connection-error';
import {
  createCommentThreadSchema,
  replyToCommentSchema,
  resolveCommentSchema,
} from '@porcelain/contracts/comments';
import { createId } from '../../lib/id';
import type { createMockStore } from '../inventory/mock';
import { createInventoryMock } from '../inventory/mock';
import type { ReviewRequest } from '../review/port';
import type { CommentsPort } from './port';
export function createCommentsMock(
  store: ReturnType<typeof createMockStore>,
): CommentsPort {
  async function context(request: ReviewRequest) {
    const inventory = await createInventoryMock(store).read({
      signal: request.signal,
    });
    if (
      !inventory.projects.some(
        (project) =>
          project.id === request.projectId &&
          project.worktrees.some(
            (worktree) => worktree.id === request.worktreeId,
          ),
      ) ||
      store.commentsFailed
    )
      throw new ConnectionError(
        'Comments are unavailable. Refresh the discussion and try again.',
      );
    return store.comments[request.worktreeId] ?? [];
  }
  return {
    async list(request) {
      return structuredClone(await context(request));
    },
    async create(request) {
      const threads = await context(request);
      const input = createCommentThreadSchema.parse(request.input);
      request.signal.throwIfAborted();
      const thread = {
        id: createId(),
        worktreeId: request.worktreeId,
        anchor: input.anchor,
        resolved: false,
        messages: [
          {
            id: createId(),
            body: input.body,
            author: 'reviewer' as const,
            createdAt: new Date().toISOString(),
          },
        ],
      };
      store.comments[request.worktreeId] = [...threads, thread];
      return structuredClone([thread]);
    },
    async reply(request) {
      const threads = await context(request);
      const input = replyToCommentSchema.parse(request.input);
      request.signal.throwIfAborted();
      const thread = threads.find(
        (candidate) => candidate.id === request.threadId,
      );
      if (!thread)
        throw new ConnectionError(
          'That comment thread is no longer available. Refresh the discussion.',
        );
      const updated = {
        ...thread,
        messages: [
          ...thread.messages,
          {
            id: createId(),
            body: input.body,
            author: 'reviewer' as const,
            createdAt: new Date().toISOString(),
          },
        ],
      };
      store.comments[request.worktreeId] = threads.map((candidate) =>
        candidate.id === updated.id ? updated : candidate,
      );
      return structuredClone([updated]);
    },
    async resolve(request) {
      const threads = await context(request);
      const input = resolveCommentSchema.parse(request.input);
      request.signal.throwIfAborted();
      const thread = threads.find(
        (candidate) => candidate.id === request.threadId,
      );
      if (!thread)
        throw new ConnectionError(
          'That comment thread is no longer available. Refresh the discussion.',
        );
      const updated = { ...thread, resolved: input.resolved };
      store.comments[request.worktreeId] = threads.map((candidate) =>
        candidate.id === updated.id ? updated : candidate,
      );
      return structuredClone([updated]);
    },
  };
}
