import type { Api } from './api';
import { createCommentsLive } from './comments/live';
import { createFilePreferencesLive } from './file-preferences/live';
import { createGitActionsLive } from './git-actions/live';
import { createInventoryLive } from './inventory/live';
import { createPairingLive } from './pairing/live';
import { createReviewLive } from './review/live';
import { browserTransport, createSessionLive } from './session/live';

export async function createBootApi(): Promise<Api> {
  // Every live request goes through the browser transport now: the browser
  // authenticates with its device cookie and nothing else, in the playground
  // as well as in a real installation.
  const transport = browserTransport(fetch);
  return {
    session: createSessionLive(transport),
    comments: createCommentsLive(transport),
    filePreferences: createFilePreferencesLive(transport),
    inventory: createInventoryLive(transport),
    pairing: createPairingLive(transport),
    review: createReviewLive(transport),
    gitActions: createGitActionsLive(transport),
  };
}
