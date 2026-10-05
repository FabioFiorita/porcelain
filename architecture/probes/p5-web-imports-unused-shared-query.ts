import type { Probe } from '../probe.ts';

export default {
  decision: 'P5',
  plants: 'web uses a shared query whose endpoint has no feature map entry',
  gate: 'features',
  rule: 'the web calls PUT /api/worktrees/:worktreeId/review: no map file lists it in its api',
  edits: [
    {
      kind: 'append',
      path: 'packages/client/src/features/files/api.ts',
      content: `
import { ReviewsApi as ProbeReviewsApi, type PublishReviewRequest } from '@porcelain/contracts/reviews';
import { HttpApiClient as ProbeClient } from 'effect/http-api';
export function probePublish(transport: Transport, worktreeId: string, body: PublishReviewRequest, signal: AbortSignal) {
  const client = Effect.runSync(ProbeClient.makeWith(ProbeReviewsApi, { httpClient: transportClient(transport) }));
  return client.reviews.publishReview({ params: { worktreeId }, payload: body });
}
`,
    },
    {
      kind: 'create',
      path: 'packages/client/src/features/files/queries/probe-publish.ts',
      content: `
import { probePublish } from '../api.ts';
import type { Transport } from '../../../shared/api/transport.ts';
import type { PublishReviewRequest } from '@porcelain/contracts/reviews';
export function probePublishQueryOptions(transport: Transport, worktreeId: string, body: PublishReviewRequest, signal: AbortSignal) {
  return { queryFn: () => probePublish(transport, worktreeId, body, signal) };
}
`,
    },
    {
      kind: 'append',
      path: 'packages/client/src/features/files/index.ts',
      content:
        "\nexport { probePublishQueryOptions } from './queries/probe-publish.ts';\n",
    },
    {
      kind: 'append',
      path: 'apps/web/src/features/files/queries/preview-assets.ts',
      content:
        "\nimport { probePublishQueryOptions as options } from '@porcelain/client/files';\nexport const probePublishQuery = options;\n",
    },
  ],
} satisfies Probe;
