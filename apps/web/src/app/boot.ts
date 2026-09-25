import type { Api } from './api';
import { createCommentsLive } from '@/features/review/index';
import { createFilePreferencesLive } from '@/features/projects/index';
import { createGitActionsLive } from '@/features/review/index';
import { createInventoryLive } from '@/features/projects/index';
import { createLiveUpdatesLive } from '../shared/live/socket';
import { createPairingLive } from '@/features/access/index';
import { createReviewLive } from '@/features/review/index';
import { createSessionLive } from '@/features/access/index';
import { browserTransport } from '../shared/api/transport';

export async function createBootApi(): Promise<Api> {
  const transport = browserTransport(fetch);
  const restoringTransport = browserTransport(fetch, {
    reportUnauthorized: false,
  });
  return {
    session: createSessionLive(restoringTransport, transport),
    comments: createCommentsLive(transport),
    filePreferences: createFilePreferencesLive(transport),
    inventory: createInventoryLive(transport),
    liveUpdates: createLiveUpdatesLive(),
    pairing: createPairingLive(transport),
    review: createReviewLive(transport),
    gitActions: createGitActionsLive(transport),
  };
}
