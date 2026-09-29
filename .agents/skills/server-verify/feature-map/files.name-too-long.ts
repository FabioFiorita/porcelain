import { randomUUID } from 'node:crypto';
import { defineCase, defineFeature, type Session } from '../scripts/feature.ts';
import {
  sampleReview,
  unreadablePath,
  worktreePath,
} from '../scripts/fixture.ts';

const longName = `${'n'.repeat(300)}.png`;
const text = (session: Session) => ({
  method: 'GET' as const,
  path: worktreePath(session, '/text'),
  query: { path: longName },
});

export default defineFeature({
  feature: 'files.name-too-long',
  reaches: [
    'GET /api/worktrees/:worktreeId/text',
    'PUT /api/worktrees/:worktreeId/review',
  ],
  paired: true,
  intent: 'intended',
  behaviour:
    'A path whose name is longer than the file system allows cannot name a file in the worktree: reading it as text is refused as unreadable, and a review whose proof names it is refused as naming an unreadable proof file.',
  cases: [
    defineCase({
      name: 'read a name longer than the file system allows',
      request: text,
      expect({ response, check }) {
        check('status', 422, response.status);
        check('error body', unreadablePath, response.body);
      },
    }),
    defineCase({
      name: 'attach a proof file with such a name',
      request: (session) => ({
        method: 'PUT',
        path: worktreePath(session, '/review'),
        body: {
          ...sampleReview(session, 0, randomUUID(), randomUUID()),
          proof: {
            assets: [{ kind: 'image', title: 'Shot', path: longName }],
          },
        },
      }),
      expect({ response, check }) {
        check('status', 422, response.status);
        check(
          'error body',
          {
            statusCode: 422,
            error: 'Unprocessable Entity',
            message:
              'A proof file is missing from the worktree or is not a readable file',
          },
          response.body,
        );
      },
    }),
  ],
});
