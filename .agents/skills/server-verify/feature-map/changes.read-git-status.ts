import { readGitStatusResponseSchema } from '../../../../packages/contracts/src/changes/index.ts';
import {
  defineCase,
  defineFeature,
  invalidRequest,
  record,
  unknownWorktreeId,
} from '../scripts/feature.ts';
import { changes, worktreeNotFound, worktreePath } from '../scripts/fixture.ts';

export default defineFeature({
  feature: 'changes.read-git-status',
  reaches: 'GET /api/worktrees/:worktreeId/git/status',
  intent: 'observed',
  behaviour:
    "A reviewer reads a worktree's Git status as Git reports it, best effort: the flat list of staged, unstaged, untracked and unmerged entries, the head commit's subject, and the branch with its upstream, remote, stashes and recently discarded hunks. Its status token matches the one the changes read reports for the same state.",
  cases: [
    defineCase({
      name: 'the sample unstaged change',
      async setup(session) {
        return {
          head: (await session.git('rev-parse', 'HEAD')).trim(),
          changes: await changes(session),
        };
      },
      request: (session) => ({
        method: 'GET',
        path: worktreePath(session, '/git/status'),
      }),
      expect({ response, state, session, check, checkPartial, checkContract }) {
        check('status', 200, response.status);
        checkContract('contract', readGitStatusResponseSchema, response.body);
        checkPartial(
          'body',
          {
            worktreeId: session.worktreeId,
            statusToken: state.changes.statusToken,
            branch: {
              name: 'main',
              upstream: null,
              ahead: 0,
              behind: 0,
              remoteName: null,
              sourceRef: null,
              upstreamOid: null,
              stashes: [],
              discarded: [],
            },
            consistency: 'best-effort',
            headOid: state.head,
            inProgress: null,
            mergeHeadOid: null,
            headCommit: { subject: 'Initial commit' },
            changes: [
              {
                scope: 'unstaged',
                kind: 'modified',
                oldPath: 'README.md',
                newPath: 'README.md',
              },
            ],
          },
          response.body,
        );
      },
    }),
    defineCase({
      name: 'a stash is listed',
      async setup(session) {
        await session.git('stash', 'push', '-m', 'Parked work');
        return (await session.git('rev-parse', 'stash@{0}')).trim();
      },
      request: (session) => ({
        method: 'GET',
        path: worktreePath(session, '/git/status'),
      }),
      expect({ response, state, check }) {
        const body = record(response.body);
        check(
          'stashes',
          [{ oid: state, message: 'On main: Parked work' }],
          record(body.branch).stashes,
        );
        check('no changes remain', [], body.changes);
      },
    }),
    defineCase({
      name: 'unknown or malformed worktree',
      request: () => [
        {
          method: 'GET',
          path: `/api/worktrees/${unknownWorktreeId}/git/status`,
        },
        { method: 'GET', path: '/api/worktrees/not-an-id/git/status' },
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
