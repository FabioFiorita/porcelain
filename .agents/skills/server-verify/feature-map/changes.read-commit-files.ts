import { readCommitFilesResponseSchema } from '../../../../packages/contracts/src/changes/index.ts';
import {
  apiError,
  defineCase,
  defineFeature,
  invalidRequest,
  record,
  unknownOid,
  unknownWorktreeId,
  type Session,
} from '../scripts/feature.ts';
import {
  threeCommits,
  worktreeNotFound,
  worktreePath,
} from '../scripts/fixture.ts';

const files = (
  session: Session,
  oid: string,
  query?: Record<string, number>,
) => ({
  method: 'GET' as const,
  path: worktreePath(session, `/commits/${oid}/files`),
  ...(query ? { query } : {}),
});

export default defineFeature({
  feature: 'changes.read-commit-files',
  reaches: 'GET /api/worktrees/:worktreeId/commits/:oid/files',
  intent: 'intended',
  behaviour:
    'A reviewer lists the files one commit changed, compared with a chosen parent (the first by default) or with the empty tree for a root commit, including renames. A parent the commit does not have is an invalid history request; a commit the repository does not have is not found.',
  cases: [
    defineCase({
      name: 'rename against the first parent',
      setup: threeCommits,
      request: (session, state) => files(session, state.rename),
      expect({ response, state, check, checkPartial, checkContract }) {
        check('status', 200, response.status);
        checkContract('contract', readCommitFilesResponseSchema, response.body);
        checkPartial(
          'commit',
          { oid: state.rename, subject: 'Rename' },
          record(response.body).commit,
        );
        check(
          'comparison',
          { kind: 'parent', parentNumber: 1, baseOid: state.second },
          record(response.body).comparison,
        );
        check(
          'files',
          [
            {
              oldPath: 'README.md',
              newPath: 'GUIDE.md',
              status: 'renamed',
              oldMode: '100644',
              newMode: '100644',
            },
          ],
          record(response.body).files,
        );
      },
    }),
    defineCase({
      name: 'root commit against the empty tree',
      setup: async (session) =>
        (await session.git('rev-list', '--max-parents=0', 'HEAD')).trim(),
      request: (session, root) => files(session, root),
      expect({ response, check }) {
        check('status', 200, response.status);
        check(
          'comparison',
          { kind: 'empty-tree' },
          record(response.body).comparison,
        );
        check(
          'files',
          [
            {
              oldPath: null,
              newPath: 'README.md',
              status: 'added',
              oldMode: '000000',
              newMode: '100644',
            },
          ],
          record(response.body).files,
        );
      },
    }),
    defineCase({
      name: 'a parent the commit does not have',
      setup: async (session) => (await session.git('rev-parse', 'HEAD')).trim(),
      request: (session, head) => files(session, head, { parent: 2 }),
      expect({ response, check }) {
        check('status', 400, response.status);
        check(
          'error body',
          apiError(400, 'Bad Request', 'Invalid history request'),
          response.body,
        );
      },
    }),
    defineCase({
      name: 'unknown commit, malformed commit or unknown worktree',
      request: (session) => [
        files(session, unknownOid),
        files(session, 'abc'),
        {
          method: 'GET',
          path: `/api/worktrees/${unknownWorktreeId}/commits/${unknownOid}/files`,
        },
      ],
      expect({ responses, check }) {
        check('unknown commit status', 404, responses[0]?.status);
        check(
          'unknown commit error body',
          apiError(404, 'Not Found', 'Commit not found'),
          responses[0]?.body,
        );
        check('malformed status', 400, responses[1]?.status);
        check('malformed error body', invalidRequest, responses[1]?.body);
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
