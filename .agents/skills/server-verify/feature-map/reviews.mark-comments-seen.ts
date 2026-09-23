import { markCommentsSeenResponseSchema } from '../../../../packages/contracts/src/reviews/index.ts';
import {
  defineCase,
  defineFeature,
  invalidRequest,
  unknownWorktreeId,
  type Session,
} from '../scripts/feature.ts';
import { worktreeNotFound, worktreePath } from '../scripts/fixture.ts';

const seen = (session: Session, throughRevision: unknown) => ({
  method: 'POST' as const,
  path: worktreePath(session, '/comments/seen'),
  body: { throughRevision },
});

async function twoThreads(session: Session) {
  for (const body of ['First', 'Second'])
    await session.send({
      method: 'POST',
      path: worktreePath(session, '/comments'),
      body: { anchor: { kind: 'file', filePath: 'README.md' }, body },
    });
}

export default defineFeature({
  feature: 'reviews.mark-comments-seen',
  reaches: 'POST /api/worktrees/:worktreeId/comments/seen',
  intent: 'observed',
  behaviour:
    "A reviewer records that they have seen the worktree's comments up to a revision. A revision beyond the latest is clamped to the latest, the mark never moves back, and the answer states what is now recorded as seen.",
  cases: [
    defineCase({
      name: 'through an existing revision',
      setup: twoThreads,
      request: (session) => seen(session, 1),
      expect({ response, session, check, checkContract }) {
        check('status', 200, response.status);
        checkContract(
          'contract',
          markCommentsSeenResponseSchema,
          response.body,
        );
        check(
          'body',
          { worktreeId: session.worktreeId, seenThrough: 1 },
          response.body,
        );
      },
    }),
    defineCase({
      name: 'beyond the latest revision',
      request: (session) => seen(session, 9999),
      expect({ response, session, check }) {
        check(
          'clamped to the latest',
          { worktreeId: session.worktreeId, seenThrough: 2 },
          response.body,
        );
      },
    }),
    defineCase({
      name: 'an earlier revision after a later one',
      request: (session) => seen(session, 1),
      expect({ response, session, check }) {
        check(
          'never moves back',
          { worktreeId: session.worktreeId, seenThrough: 2 },
          response.body,
        );
      },
    }),
    defineCase({
      name: 'invalid input or unknown worktree',
      request: (session) => [
        seen(session, -1),
        seen(session, 'all'),
        {
          method: 'POST',
          path: `/api/worktrees/${unknownWorktreeId}/comments/seen`,
          body: { throughRevision: 1 },
        },
      ],
      expect({ responses, check }) {
        for (const [index, response] of responses.slice(0, 2).entries()) {
          check(`invalid request ${index + 1} status`, 400, response.status);
          check(
            `invalid request ${index + 1} error body`,
            invalidRequest,
            response.body,
          );
        }
        check('unknown worktree status', 404, responses[2]?.status);
        check(
          'unknown worktree error body',
          worktreeNotFound,
          responses[2]?.body,
        );
      },
    }),
  ],
});
