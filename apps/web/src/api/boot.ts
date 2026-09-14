import type { Api } from './api';
import { createCommentsLive } from './comments/live';
import { createFilePreferencesLive } from './file-preferences/live';
import { createGitActionsLive } from './git-actions/live';
import { createInventoryLive } from './inventory/live';
import { createReviewLive } from './review/live';
import { browserTransport, createSessionLive } from './session/live';

export async function createBootApi(): Promise<Api> {
  const transport = import.meta.env.PORCELAIN_PLAYGROUND_BRIDGE
    ? fetch
    : browserTransport(fetch);
  return {
    session: createSessionLive(transport),
    comments: createCommentsLive(transport),
    filePreferences: createFilePreferencesLive(transport),
    inventory: createInventoryLive(transport),
    review: createReviewLive(transport),
    gitActions: createGitActionsLive(transport),
  };
}
