import type { ReviewPort } from './review-port';
import { createChangesLive } from './changes-live';
import { createFilesLive } from './files-live';
import { createPublishedReviewLive } from './published-review-live';
import { createReviewedLive } from './reviewed-live';

export function createReviewLive(transport: typeof fetch): ReviewPort {
  return {
    ...createChangesLive(transport),
    ...createFilesLive(transport),
    ...createPublishedReviewLive(transport),
    ...createReviewedLive(transport),
  };
}
