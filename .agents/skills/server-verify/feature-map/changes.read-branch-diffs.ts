import { readBranchDiffsResponseSchema } from '@porcelain/contracts/changes';
import {
  apiError,
  defineCase,
  defineFeature,
  invalidRequest,
  unknownOid,
  unknownWorktreeId,
  type Session,
} from '../scripts/feature.ts';
import { head, worktreeNotFound, worktreePath } from '../scripts/fixture.ts';

const diffs = (session: Session, body: unknown) => ({
  method: 'POST' as const,
  path: worktreePath(session, '/branch-changes/diffs'),
  body,
});

export default defineFeature({
  feature: 'changes.read-branch-diffs',
  reaches: 'POST /api/worktrees/:worktreeId/branch-changes/diffs',
  paired: true,
  intent: 'intended',
  behaviour:
    'A reviewer reads the diffs of chosen paths between the merge base and the branch tip they were shown, each path alone or as an old and new pair for a rename, and gets the patch Git reports between those two commits whatever the worktree holds now. A path the branch did not touch has an empty metadata-only patch. A commit the repository does not have is not found.',
  cases: [
    defineCase({
      name: 'patches between the fork point and the tip',
      async setup(session) {
        const fork = await head(session);
        await session.git('switch', '-c', 'feature');
        await session.git('mv', session.fixture.readme.path, 'GUIDE.md');
        await session.git('commit', '-m', 'Rename the readme');
        await session.writeFile('notes.md', 'notes\n');
        await session.git('add', 'notes.md');
        await session.git('commit', '-m', 'Add notes');
        await session.writeFile('notes.md', 'uncommitted\n');
        const tip = await head(session);
        return {
          fork,
          tip,
          renamed: await session.git(
            'diff',
            '-M',
            fork,
            tip,
            '--',
            session.fixture.readme.path,
            'GUIDE.md',
          ),
          added: await session.git('diff', fork, tip, '--', 'notes.md'),
        };
      },
      request: (session, state) =>
        diffs(session, {
          baseOid: state.fork,
          headOid: state.tip,
          paths: [
            [session.fixture.readme.path, 'GUIDE.md'],
            ['notes.md'],
            ['untouched.md'],
          ],
        }),
      expect({ response, state, session, check, checkContract }) {
        check('status', 200, response.status);
        checkContract('contract', readBranchDiffsResponseSchema, response.body);
        check(
          'the committed changes, not the uncommitted edit',
          {
            diffs: [
              {
                paths: [session.fixture.readme.path, 'GUIDE.md'],
                content: { kind: 'metadata-only', patch: state.renamed },
              },
              {
                paths: ['notes.md'],
                content: { kind: 'text', patch: state.added },
              },
              {
                paths: ['untouched.md'],
                content: { kind: 'metadata-only', patch: '' },
              },
            ],
          },
          response.body,
        );
      },
    }),
    defineCase({
      name: 'a commit the repository does not have',
      setup: head,
      request: (session, tip) =>
        diffs(session, {
          baseOid: unknownOid,
          headOid: tip,
          paths: [['GUIDE.md']],
        }),
      expect({ response, check }) {
        check('status', 404, response.status);
        check(
          'error body',
          apiError(404, 'Not Found', 'Commit not found'),
          response.body,
        );
      },
    }),
    defineCase({
      name: 'invalid input or unknown worktree',
      request: (session) => [
        diffs(session, { baseOid: unknownOid, headOid: unknownOid, paths: [] }),
        diffs(session, {
          baseOid: 'main',
          headOid: unknownOid,
          paths: [['a']],
        }),
        {
          method: 'POST',
          path: `/api/worktrees/${unknownWorktreeId}/branch-changes/diffs`,
          body: { baseOid: unknownOid, headOid: unknownOid, paths: [['a']] },
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
