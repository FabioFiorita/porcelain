import { createReviewClient } from '@porcelain/client/review';
import type { ReviewPort } from './port';
export function createReviewLive(transport: typeof fetch): ReviewPort {
  const client = createReviewClient(transport, '/api');
  return {
    ...client,
    changes: async (request) => ({ changes: await client.changes(request) }),
  };
}
