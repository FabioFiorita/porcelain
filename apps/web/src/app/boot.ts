import type { Api } from './api';
import { createCommentsLive } from '@/features/review/index';
import { createGitActionsLive } from '@/features/review/index';
import { createLiveUpdatesLive } from '../shared/live/socket';
import { accessApi } from '@/features/access/api';
import { createReviewLive } from '@/features/review/index';
import { browserTransport } from '../shared/api/transport';

export async function createBootApi(): Promise<Api> {
  const transport = browserTransport(fetch);
  return {
    session: accessApi.session,
    comments: createCommentsLive(transport),
    liveUpdates: createLiveUpdatesLive(),
    pairing: accessApi.pairing,
    review: createReviewLive(transport),
    gitActions: createGitActionsLive(transport),
  };
}
