import type { Api } from './api';
import { createCommentsMock } from './comments/mock';
import { createGitActionsMock } from './git-actions/mock';
import { createInventoryMock, type createMockStore } from './inventory/mock';
import { createReviewMock } from './review/mock';
import { createSessionMock } from './session/mock';

export function createMockApi(store: ReturnType<typeof createMockStore>): Api {
  return {
    session: createSessionMock(store),
    comments: createCommentsMock(store),
    inventory: createInventoryMock(store),
    review: createReviewMock(store),
    gitActions: createGitActionsMock(store),
  };
}
