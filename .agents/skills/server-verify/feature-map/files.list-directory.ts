import { listDirectoryResponseSchema } from '@porcelain/contracts/files';
import {
  apiError,
  defineCase,
  defineFeature,
  invalidRequest,
  list,
  record,
  unknownWorktreeId,
  type Session,
} from '../scripts/feature.ts';
import {
  unreadablePath,
  worktreeNotFound,
  worktreePath,
} from '../scripts/fixture.ts';

const directory = (session: Session, path?: string) => ({
  method: 'GET' as const,
  path: worktreePath(session, '/directory'),
  ...(path === undefined ? {} : { query: { path } }),
});

export default defineFeature({
  feature: 'files.list-directory',
  reaches: 'GET /api/worktrees/:worktreeId/directory',
  paired: true,
  intent: 'intended',
  behaviour:
    'A reviewer browses a worktree folder by folder, from the root (empty path). Entries are named with their kind and ignored entries are flagged. The .git folder is never listed, and a path into it is invalid input like any path that escapes the worktree; a missing folder is not found. A symbolic link is listed as a link with its target and is not followed: a folder behind one that leaves the worktree cannot be read (422).',
  cases: [
    defineCase({
      name: 'root with an ignored file',
      async setup(session) {
        await session.writeFile('.gitignore', 'build.log\n');
        await session.writeFile('build.log', 'ignored\n');
      },
      request: (session) => directory(session, ''),
      expect({ response, session, check, checkContract }) {
        check('status', 200, response.status);
        checkContract('contract', listDirectoryResponseSchema, response.body);
        check(
          'body',
          {
            worktreeId: session.worktreeId,
            path: '',
            entries: [
              { name: '.gitignore', kind: 'file' },
              { name: session.fixture.readme.path, kind: 'file' },
              { name: 'build.log', kind: 'file', ignored: true },
            ],
          },
          response.body,
        );
      },
    }),
    defineCase({
      name: 'missing folder',
      request: (session) => directory(session, 'missing'),
      expect({ response, check }) {
        check('status', 404, response.status);
        check(
          'error body',
          apiError(404, 'Not Found', 'Path not found'),
          response.body,
        );
      },
    }),
    defineCase({
      name: 'the .git folder',
      request: (session) => directory(session, '.git'),
      expect({ response, check }) {
        check('status', 400, response.status);
        check('error body', invalidRequest, response.body);
      },
    }),
    defineCase({
      name: 'invalid input or unknown worktree',
      request: (session) => [
        directory(session, '../'),
        directory(session),
        {
          method: 'GET',
          path: `/api/worktrees/${unknownWorktreeId}/directory`,
          query: { path: '' },
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
    defineCase({
      name: 'a symbolic link out of the worktree',
      setup: (session) => session.symlink('..', 'up'),
      request: (session) => [directory(session, 'up'), directory(session, '')],
      expect({ responses, check, checkPartial }) {
        check('link status', 422, responses[0]?.status);
        check('link error body', unreadablePath, responses[0]?.body);
        check('root status', 200, responses[1]?.status);
        checkPartial(
          'the root names the link without following it',
          [{ name: 'up', kind: 'symlink', target: '..' }],
          list(record(responses[1]?.body).entries).filter(
            (entry) => record(entry).name === 'up',
          ),
        );
      },
    }),
  ],
});
