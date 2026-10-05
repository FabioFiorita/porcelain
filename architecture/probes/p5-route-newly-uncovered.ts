import type { Probe } from '../probe.ts';

export default {
  decision: 'P5',
  plants: 'web calls the native review publisher without a feature map entry',
  gate: 'features',
  rule: 'the web calls PUT /api/worktrees/:worktreeId/review: no map file lists it in its api',
  edits: [
    {
      kind: 'append',
      path: 'apps/web/src/features/reviews/commands/reviewed.ts',
      content: `
import { ReviewsApi as ProbeReviewsApi, type PublishReviewRequest } from '@porcelain/contracts/reviews';
import type { HttpClient } from 'effect/http';
import { HttpApiClient as ProbeClient } from 'effect/http-api';
import { Effect as ProbeEffect } from 'effect';
export function probePublish(httpClient: HttpClient.HttpClient, worktreeId: string, payload: PublishReviewRequest) {
  const client = ProbeEffect.runSync(ProbeClient.makeWith(ProbeReviewsApi, { httpClient }));
  return client.reviews.publishReview({ params: { worktreeId }, payload });
}
`,
    },
  ],
} satisfies Probe;
