import type { Api } from './api';
import { createCommentsLive } from './comments/live';
import { createGitActionsLive } from './git-actions/live';
import { createInventoryLive } from './inventory/live';
import { createReviewLive } from './review/live';

export async function createBootApi(): Promise<Api> {
  if (import.meta.env.VITE_API_MODE === 'mock') {
    const { createBootMockApi } = await import('./mock-api');
    return createBootMockApi();
  }
  return {
    comments: createCommentsLive(fetch),
    inventory: createInventoryLive(fetch),
    review: createReviewLive(fetch),
    gitActions: createGitActionsLive(fetch),
  };
}
