import { createReviewClient } from '@porcelain/client/review';
import type { ReviewPort } from './port';
export function createReviewLive(transport: typeof fetch): ReviewPort {
  return createReviewClient(transport, '/api');
}
