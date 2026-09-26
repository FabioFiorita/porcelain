import type { ReviewPort } from './review-port';
import { createChangesLive } from './changes-live';
import { createPublishedReviewLive } from './published-review-live';
import { createReviewedLive } from './reviewed-live';

export function createReviewLive(transport: typeof fetch): ReviewPort {
  return {
    ...createChangesLive(transport),
    ...createPublishedReviewLive(transport),
    ...createReviewedLive(transport),
  };
}
