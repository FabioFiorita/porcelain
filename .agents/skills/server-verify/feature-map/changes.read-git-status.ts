import { randomUUID } from 'node:crypto';
import { readGitStatusResponseSchema } from '@porcelain/contracts/changes';
import {
  defineCase,
  defineFeature,
  invalidRequest,
  list,
  record,
  unknownWorktreeId,
  type Session,
} from '../scripts/feature.ts';
import {
  changes,
  expectation,
  fingerprintOf,
  gitPath,
  head,
  settledReceipt,
  worktreeNotFound,
  worktreePath,
} from '../scripts/fixture.ts';

const lineCount = (text: string) => text.split('\n').length - 1;
const status = (session: Session) => ({
  method: 'GET' as const,
  path: worktreePath(session, '/git/status'),
});

export default defineFeature({
  feature: 'changes.read-git-status',
  reaches: 'GET /api/worktrees/:worktreeId/git/status',
  paired: true,
  intent: 'observed',
  behaviour:
    "A reviewer reads a worktree's Git status as Git reports it, best effort: the flat list of staged, unstaged, untracked and unmerged entries, the head commit's subject, and the branch with its upstream, remote, stashes and recently discarded hunks. Its status token matches the one the changes read reports for the same state.",
  cases: [
    defineCase({
      name: 'the sample unstaged change',
      async setup(session) {
        return { head: await head(session), changes: await changes(session) };
      },
      request: status,
      expect({ response, state, session, check, checkPartial, checkContract }) {
        check('status', 200, response.status);
        checkContract('contract', readGitStatusResponseSchema, response.body);
        checkPartial(
          'body',
          {
            worktreeId: session.worktreeId,
            statusToken: state.changes.statusToken,
            branch: {
              name: session.fixture.branch,
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
            headCommit: { subject: session.fixture.initialCommit },
            changes: [
              {
                scope: 'unstaged',
                kind: 'modified',
                oldPath: session.fixture.readme.path,
                newPath: session.fixture.readme.path,
              },
            ],
          },
          response.body,
        );
      },
    }),
    defineCase({
      name: 'a branch with an upstream one commit behind',
      async setup(session) {
        const remote = `${session.projectHome}/remote.git`;
        const branch = session.fixture.branch;
        await session.git('init', '--bare', '-b', branch, remote);
        await session.git('remote', 'add', 'origin', remote);
        await session.git('push', '--set-upstream', 'origin', branch);
        const upstream = await head(session);
        await session.git('commit', '--allow-empty', '-m', 'Local only');
        return upstream;
      },
      request: status,
      expect({ response, state, session, check, checkPartial }) {
        check('status', 200, response.status);
        checkPartial(
          'branch',
          {
            name: session.fixture.branch,
            upstream: `origin/${session.fixture.branch}`,
            ahead: 1,
            behind: 0,
            remoteName: 'origin',
            sourceRef: `refs/heads/${session.fixture.branch}`,
            upstreamOid: state,
          },
          record(response.body).branch,
        );
      },
    }),
    defineCase({
      name: 'a discarded hunk is kept for restoring',
      async setup(session) {
        const path = session.fixture.readme.path;
        const requestId = randomUUID();
        await session.read(
          {
            method: 'POST',
            path: gitPath(session, '/actions'),
            body: {
              requestId,
              input: {
                action: 'discard',
                path,
                hunk: {
                  scope: 'unstaged',
                  startLine: lineCount(session.fixture.readme.committed) + 1,
                  endLine: lineCount(session.fixture.readme.changed),
                },
              },
              expected: {
                ...(await expectation(session)),
                files: [
                  { path, fingerprint: await fingerprintOf(session, path) },
                ],
              },
            },
          },
          202,
        );
        await settledReceipt(session, requestId);
        return (
          await session.git(
            'for-each-ref',
            '--format=%(objectname)',
            'refs/porcelain/discarded',
          )
        ).trim();
      },
      request: status,
      expect({ response, state, session, check }) {
        check('status', 200, response.status);
        const body = record(response.body);
        check(
          'discarded',
          [{ oid: state, path: session.fixture.readme.path, kind: 'hunk' }],
          record(body.branch).discarded,
        );
        check('no changes remain', [], body.changes);
      },
    }),
    defineCase({
      name: 'a stash is listed',
      async setup(session) {
        await session.writeFile(session.fixture.readme.path, 'Parked\n');
        await session.git('stash', 'push', '-m', 'Parked work');
        return (await session.git('rev-parse', 'stash@{0}')).trim();
      },
      request: status,
      expect({ response, state, session, check }) {
        check('status', 200, response.status);
        const body = record(response.body);
        check(
          'the stash is listed first',
          { oid: state, message: `On ${session.fixture.branch}: Parked work` },
          list(record(body.branch).stashes)[0],
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
