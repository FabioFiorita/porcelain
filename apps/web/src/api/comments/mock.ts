import { ConnectionError } from '@porcelain/client/errors/connection-error';
import { createCommentThreadSchema } from '@porcelain/contracts/comments';
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
      token: request.token,
      signal: request.signal,
      refresh: false,
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
      store.comments[request.worktreeId] = [
        ...threads,
        {
          id: createId(),
          worktreeId: request.worktreeId,
          anchor: input.anchor,
          resolved: false,
          messages: [{ id: createId(), body: input.body, author: 'reviewer' }],
        },
      ];
      return structuredClone(store.comments[request.worktreeId] ?? []);
    },
  };
}
