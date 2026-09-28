import type { Api } from './api';
import { createCommentsLive, createReviewsLive } from '@/features/reviews/api';
import { createGitActionsLive } from '@/features/git-actions/api';
import { createLiveUpdatesLive } from '../shared/live/socket';
import { accessApi } from '@/features/access/api';
import { browserTransport } from '../shared/api/transport';

export async function createBootApi(): Promise<Api> {
  const transport = browserTransport(fetch);
  return {
    session: accessApi.session,
    comments: createCommentsLive(transport),
    liveUpdates: createLiveUpdatesLive(),
    pairing: accessApi.pairing,
    reviews: createReviewsLive(transport),
    gitActions: createGitActionsLive(transport),
  };
}
