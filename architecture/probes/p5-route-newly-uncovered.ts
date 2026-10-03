import type { Probe } from '../probe.ts';

export default {
  decision: 'P5',
  plants: 'a new web api call to publish a review that no feature map lists',
  gate: 'features',
  rule: 'the web calls PUT /api/worktrees/:worktreeId/review: no map file lists it in its api',
  edits: [
    {
      kind: 'append',
      path: 'apps/web/src/features/reviews/api.ts',
      content:
        "\nimport { publishReviewEndpoint as probeEndpoint, type PublishReviewRequest } from '@porcelain/contracts/reviews';\nimport { requestEndpoint as callEndpoint } from '@porcelain/client/transport';\nexport function probePublish(transport: Transport, worktreeId: string, body: PublishReviewRequest, signal: AbortSignal) {\n  return callEndpoint(transport, probeEndpoint, { params: { worktreeId }, body, signal });\n}\n",
    },
  ],
} satisfies Probe;
