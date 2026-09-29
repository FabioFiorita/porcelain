import { listFileCommitsResponseSchema } from '@porcelain/contracts/changes';
import {
  defineCase,
  defineFeature,
  invalidRequest,
  unknownWorktreeId,
  type Session,
} from '../scripts/feature.ts';
import {
  read,
  threeCommits,
  worktreeNotFound,
  worktreePath,
} from '../scripts/fixture.ts';

const fileCommits = (
  session: Session,
  query: Record<string, string | number>,
) => ({
  method: 'GET' as const,
  path: worktreePath(session, '/file-commits'),
  query,
});

export default defineFeature({
  feature: 'changes.list-file-commits',
  reaches: 'GET /api/worktrees/:worktreeId/file-commits',
  paired: true,
  intent: 'intended',
  behaviour:
    'A reviewer reads the timeline of one file: the commits reachable from the head that touched it, newest first, following it back across renames. Each entry carries the commit, the path the file had in it, the path it was renamed from, and how the commit changed it. The timeline holds at most the requested number of commits and says whether older ones exist. A merge appears only when its own result changed the file, as its change from the first parent. When the path was a folder before the file was added, the timeline ends at the commit that added the file. A path no commit touched has an empty timeline, and an invalid path or limit or an unknown worktree is refused.',
  cases: [
    defineCase({
      name: 'the timeline follows the file back across its rename',
      setup: threeCommits,
      request: (session) => fileCommits(session, { path: 'GUIDE.md' }),
      expect({ response, state, session, check, checkContract, checkPartial }) {
        check('status', 200, response.status);
        checkContract('contract', listFileCommitsResponseSchema, response.body);
        const readme = session.fixture.readme.path;
        checkPartial(
          'body',
          {
            commits: [
              {
                commit: { oid: state.rename, subject: 'Rename' },
                path: 'GUIDE.md',
                previousPath: readme,
                status: 'renamed',
              },
              {
                commit: { oid: state.second, subject: 'Second commit' },
                path: readme,
                previousPath: null,
                status: 'modified',
              },
              {
                commit: {
                  oid: state.initial,
                  subject: session.fixture.initialCommit,
                },
                path: readme,
                previousPath: null,
                status: 'added',
              },
            ],
            more: false,
          },
          response.body,
        );
      },
    }),
    defineCase({
      name: 'a limit keeps the newest commits and says older ones exist',
      request: (session) =>
        fileCommits(session, { path: 'GUIDE.md', limit: 2 }),
      async expect({ response, session, check, checkPartial }) {
        check('status', 200, response.status);
        const [rename, second] = (await session.git('rev-list', 'HEAD'))
          .trim()
          .split('\n');
        checkPartial(
          'the two newest',
          {
            commits: [{ commit: { oid: rename } }, { commit: { oid: second } }],
            more: true,
          },
          response.body,
        );
      },
    }),
    defineCase({
      name: 'a file that replaced a folder of the same name ends where it was added',
      async setup(session) {
        await read(session, {
          method: 'POST',
          path: worktreePath(session, '/files'),
          body: { kind: 'create', path: 'cfg', entryKind: 'directory' },
        });
        await session.writeFile('cfg/a.txt', 'a\n');
        await session.git('add', 'cfg');
        await session.git('commit', '-m', 'Add a cfg folder');
        await session.rename(
          `${session.repository}/cfg`,
          `${session.repository}/old-cfg`,
        );
        await session.writeFile('cfg', 'setting = 1\n');
        await session.git('add', 'cfg');
        await session.git('commit', '-m', 'Replace the folder with a file');
        return (await session.git('rev-parse', 'HEAD')).trim();
      },
      request: (session) => fileCommits(session, { path: 'cfg' }),
      expect({ response, state, check, checkPartial }) {
        check('status', 200, response.status);
        checkPartial(
          'only the file',
          {
            commits: [{ commit: { oid: state }, path: 'cfg', status: 'added' }],
            more: false,
          },
          response.body,
        );
      },
    }),
    defineCase({
      name: 'a path no commit touched has an empty timeline',
      request: (session) => fileCommits(session, { path: 'never/written.md' }),
      expect({ response, check }) {
        check('status', 200, response.status);
        check('empty', { commits: [], more: false }, response.body);
      },
    }),
    defineCase({
      name: 'invalid input or unknown worktree',
      request: (session) => [
        fileCommits(session, { path: '../outside.md' }),
        fileCommits(session, { path: 'GUIDE.md', limit: 0 }),
        {
          method: 'GET',
          path: `/api/worktrees/${unknownWorktreeId}/file-commits`,
          query: { path: 'GUIDE.md' },
        },
      ],
      expect({ responses, check }) {
        check(
          'statuses',
          [400, 400, 404],
          responses.map((entry) => entry.status),
        );
        check('traversal', invalidRequest, responses[0]?.body);
        check('limit', invalidRequest, responses[1]?.body);
        check('unknown worktree', worktreeNotFound, responses[2]?.body);
      },
    }),
  ],
});
