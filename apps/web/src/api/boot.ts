import type { Api } from './api';
import { createCommentsLive } from './comments/live';
import { createGitActionsLive } from './git-actions/live';
import { createInventoryLive } from './inventory/live';
import { createReviewLive } from './review/live';
import { browserTransport, createSessionLive } from './session/live';

export async function createBootApi(): Promise<Api> {
  if (import.meta.env.VITE_API_MODE === 'mock') {
    const { createBootMockApi } = await import('./mock-api');
    return createBootMockApi();
  }
  const transport = import.meta.env.PORCELAIN_PLAYGROUND_BRIDGE
    ? fetch
    : browserTransport(fetch);
  return {
    session: createSessionLive(transport),
    comments: createCommentsLive(transport),
    inventory: createInventoryLive(transport),
    review: createReviewLive(transport),
    gitActions: createGitActionsLive(transport),
  };
}
