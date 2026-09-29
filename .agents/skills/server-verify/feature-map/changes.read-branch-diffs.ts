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
    'A reviewer reads the diffs of chosen paths between the merge base and the branch tip they were shown, each path alone or as an old and new pair for a rename, and gets the patch Git reports between those two commits whatever the worktree holds now. Each path is read the way the branch listing paired it, a rename as its old and new path and anything else alone, and a path Git produced no patch for is refused rather than shown as unchanged. A commit the repository does not have is not found.',
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
          paths: [[session.fixture.readme.path, 'GUIDE.md'], ['notes.md']],
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
            ],
          },
          response.body,
        );
      },
    }),
    defineCase({
      name: 'a rename the listing reported apart',
      async setup(session) {
        const fork = (await session.git('rev-parse', 'feature~2')).trim();
        const tip = await head(session);
        return {
          fork,
          tip,
          deleted: await session.git(
            'diff',
            '--no-renames',
            fork,
            tip,
            '--',
            session.fixture.readme.path,
          ),
          added: await session.git(
            'diff',
            '--no-renames',
            fork,
            tip,
            '--',
            'GUIDE.md',
          ),
        };
      },
      request: (session, state) =>
        diffs(session, {
          baseOid: state.fork,
          headOid: state.tip,
          paths: [[session.fixture.readme.path], ['GUIDE.md']],
        }),
      expect({ response, state, session, check }) {
        check('status', 200, response.status);
        check(
          'a deletion and an addition, each under its own path',
          {
            diffs: [
              {
                paths: [session.fixture.readme.path],
                content: { kind: 'text', patch: state.deleted },
              },
              {
                paths: ['GUIDE.md'],
                content: { kind: 'text', patch: state.added },
              },
            ],
          },
          response.body,
        );
      },
    }),
    defineCase({
      name: 'a path the branch did not change',
      async setup(session) {
        return {
          fork: (await session.git('rev-parse', 'feature~2')).trim(),
          tip: await head(session),
        };
      },
      request: (session, state) =>
        diffs(session, {
          baseOid: state.fork,
          headOid: state.tip,
          paths: [['notes.md'], ['untouched.md']],
        }),
      expect({ response, check }) {
        check('status', 422, response.status);
        check(
          'error body',
          apiError(
            422,
            'Unprocessable Entity',
            'Diff read returned fewer results than requested',
          ),
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
