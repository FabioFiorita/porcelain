import type { Probe } from '../probe.ts';

export default {
  decision: 'P5',
  plants: 'web uses a shared query whose endpoint has no feature map entry',
  gate: 'features',
  rule: 'the web calls PUT /api/worktrees/:worktreeId/review: no map file lists it in its api',
  edits: [
    {
      kind: 'create',
      path: 'packages/client/src/features/files/queries/probe-publish.ts',
      content: `
import { Effect } from 'effect';
import { Atom } from 'effect/reactivity';
import type { RuntimeConnection } from '../../../shared/api/connection.ts';
import { porcelainClient } from '../../../shared/api/client.ts';
import { clientRuntime } from '../../../shared/api/runtime.ts';
import type { PublishReviewRequest } from '@porcelain/contracts/reviews';
export const probePublishRead = Atom.family(({ connection, worktreeId, body }: { connection: RuntimeConnection; worktreeId: string; body: PublishReviewRequest }) =>
  clientRuntime(connection).atom(Effect.gen(function* () {
    const client = yield* porcelainClient(connection);
    return yield* client.request((api) => api.reviews.publishReview({ params: { worktreeId }, payload: body }));
  }))
);
`,
    },
    {
      kind: 'append',
      path: 'packages/client/src/features/files/index.ts',
      content:
        "\nexport { probePublishRead } from './queries/probe-publish.ts';\n",
    },
    {
      kind: 'append',
      path: 'apps/web/src/features/files/queries/preview-assets.ts',
      content:
        "\nimport { probePublishRead as read } from '@porcelain/client/files';\nexport const probePublishQuery = read;\n",
    },
  ],
} satisfies Probe;
