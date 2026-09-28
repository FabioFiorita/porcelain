import type { ReviewPort } from './review-port';
import { createChangesLive } from './changes-live';

export function createReviewLive(transport: typeof fetch): ReviewPort {
  return createChangesLive(transport);
}
