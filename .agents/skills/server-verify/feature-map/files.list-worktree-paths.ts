import { listWorktreePathsResponseSchema } from '@porcelain/contracts/files';
import {
  defineCase,
  defineFeature,
  invalidRequest,
  unknownWorktreeId,
} from '../scripts/feature.ts';
import { worktreeNotFound, worktreePath } from '../scripts/fixture.ts';

export default defineFeature({
  feature: 'files.list-worktree-paths',
  reaches: 'GET /api/worktrees/:worktreeId/paths',
  paired: true,
  intent: 'observed',
  behaviour:
    'A reviewer lists every file path in a worktree for quick open: tracked and untracked files, not ignored ones, as worktree-relative paths.',
  cases: [
    defineCase({
      name: 'tracked, untracked and ignored files',
      async setup(session) {
        await session.writeFile('.gitignore', 'build.log\n');
        await session.writeFile('build.log', 'ignored\n');
        await session.writeFile('notes.txt', 'untracked\n');
      },
      request: (session) => ({
        method: 'GET',
        path: worktreePath(session, '/paths'),
      }),
      expect({ response, session, check, checkContract }) {
        check('status', 200, response.status);
        checkContract(
          'contract',
          listWorktreePathsResponseSchema,
          response.body,
        );
        check(
          'body',
          {
            worktreeId: session.worktreeId,
            paths: ['.gitignore', session.fixture.readme.path, 'notes.txt'],
          },
          response.body,
        );
      },
    }),
    defineCase({
      name: 'unknown or malformed worktree',
      request: () => [
        { method: 'GET', path: `/api/worktrees/${unknownWorktreeId}/paths` },
        { method: 'GET', path: '/api/worktrees/not-an-id/paths' },
      ],
      expect({ responses, check }) {
        check('unknown status', 404, responses[0]?.status);
        check('unknown error body', worktreeNotFound, responses[0]?.body);
        check('malformed status', 400, responses[1]?.status);
        check('malformed error body', invalidRequest, responses[1]?.body);
      },
    }),
  ],
});
