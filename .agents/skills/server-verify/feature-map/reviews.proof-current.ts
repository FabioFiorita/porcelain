import { randomUUID } from 'node:crypto';
import { defineCase, defineFeature } from '../scripts/feature.ts';
import {
  record,
  type Session,
} from '../../../../apps/server/spec/kit/session.ts';
import { sampleReview } from '../../../../apps/server/spec/kit/requests.ts';
import { worktreePath } from '../scripts/fixture.ts';

const layerId = randomUUID();
const stepId = randomUUID();
const checks = [{ name: 'pnpm test', result: 'pass' }];
const shot = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
]);
const review = (session: Session) => ({
  method: 'GET' as const,
  path: worktreePath(session, '/review'),
});
const proofOf = (body: unknown) => record(record(record(body).review).proof);

export default defineFeature({
  feature: 'reviews.proof-current',
  reaches: [
    'PUT /api/worktrees/:worktreeId/review',
    'GET /api/worktrees/:worktreeId/review',
  ],
  paired: true,
  intent: 'intended',
  behaviour:
    'Proof describes the changes it was published against: the review calls it current while the changed files are the same, and no longer current once a changed file is edited again. The proof files themselves do not count, so deleting a screenshot after publishing it keeps the proof current.',
  cases: [
    defineCase({
      name: 'proof is current when published',
      request: (session) => ({
        method: 'PUT',
        path: worktreePath(session, '/review'),
        body: {
          ...sampleReview(session, 0, layerId, stepId),
          proof: { checks },
        },
      }),
      expect({ response, check }) {
        check('status', 200, response.status);
        check(
          'current proof',
          { checks, assets: [], current: true },
          proofOf(response.body),
        );
      },
    }),
    defineCase({
      name: 'proof is no longer current after the code changes',
      async setup(session) {
        await session.writeFile(
          session.fixture.readme.path,
          `${session.fixture.readme.changed}One more line.\n`,
        );
      },
      request: review,
      expect({ response, check }) {
        check('status', 200, response.status);
        check(
          'proof that predates the change',
          { checks, assets: [], current: false },
          proofOf(response.body),
        );
      },
    }),
    defineCase({
      name: 'deleting the published screenshot keeps the proof current',
      async setup(session) {
        await session.writeFile('current-shot.png', shot);
        await session.read({
          method: 'PUT',
          path: worktreePath(session, '/review'),
          body: {
            ...sampleReview(session, 1, layerId, stepId),
            proof: {
              checks,
              assets: [
                { kind: 'image', title: 'Shot', path: 'current-shot.png' },
              ],
            },
          },
        });
        await session.remove('current-shot.png');
      },
      request: review,
      expect({ response, check, checkPartial }) {
        check('status', 200, response.status);
        checkPartial(
          'current proof with its screenshot',
          { checks, assets: [{ kind: 'image', title: 'Shot' }], current: true },
          proofOf(response.body),
        );
      },
    }),
  ],
});
