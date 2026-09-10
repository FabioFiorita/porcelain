import type { Api } from './api';
import { createCommentsMock } from './comments/mock';
import { createGitActionsMock } from './git-actions/mock';
import {
  createInventoryMock,
  createMockStore,
  type MockScenario,
} from './inventory/mock';
import { createReviewMock } from './review/mock';
import { createSessionMock } from './session/mock';

declare global {
  interface Window {
    __PORCELAIN_SCENARIO__?: MockScenario;
    __PORCELAIN_MOCK__?: ReturnType<typeof createMockStore>;
  }
}

export function createMockApi(store: ReturnType<typeof createMockStore>): Api {
  return {
    session: createSessionMock(store),
    comments: createCommentsMock(store),
    inventory: createInventoryMock(store),
    review: createReviewMock(store),
    gitActions: createGitActionsMock(store),
  };
}

export function createBootMockApi(): Api {
  const store = createMockStore(window.__PORCELAIN_SCENARIO__);
  window.__PORCELAIN_MOCK__ = store;
  return createMockApi(store);
}
