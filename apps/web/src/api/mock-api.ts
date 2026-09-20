import type { Api } from './api';
import { createCommentsMock } from './comments/mock';
import { createFilePreferencesMock } from './file-preferences/mock';
import { createGitActionsMock } from './git-actions/mock';
import { createInventoryMock, type createMockStore } from './inventory/mock';
import { createPairingMock } from './pairing/mock';
import { createReviewMock } from './review/mock';
import { createSessionMock } from './session/mock';

export function createMockApi(store: ReturnType<typeof createMockStore>): Api {
  return {
    session: createSessionMock(store),
    pairing: createPairingMock(store),
    comments: createCommentsMock(store),
    filePreferences: createFilePreferencesMock(store),
    inventory: createInventoryMock(store),
    review: createReviewMock(store),
    gitActions: createGitActionsMock(store),
  };
}
