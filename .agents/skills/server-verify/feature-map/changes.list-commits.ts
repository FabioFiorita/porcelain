import { listCommitsResponseSchema } from '@porcelain/contracts/changes';
import {
  defineCase,
  defineFeature,
  invalidRequest,
  list,
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

const commits = (
  session: Session,
  query?: Record<string, string | number>,
) => ({
  method: 'GET' as const,
  path: worktreePath(session, '/commits'),
  ...(query ? { query } : {}),
});
const author = {
  name: 'Porcelain Verification',
  timestamp: '2026-01-01T00:00:00.000Z',
};

export default defineFeature({
  feature: 'changes.list-commits',
  reaches: 'GET /api/worktrees/:worktreeId/commits',
  paired: true,
  intent: 'observed',
  behaviour:
    "A reviewer pages through a worktree's history, newest first. The first page captures a snapshot of the head; each page returns the cursor for the next one together with the tip it started from. Continuing from a tip that is no longer the snapshot's restarts the listing from the current head and says so.",
  cases: [
    defineCase({
      name: 'first page',
      setup: threeCommits,
      request: (session) => commits(session, { limit: 1 }),
      expect({ response, state, session, check, checkContract }) {
        check('status', 200, response.status);
        checkContract('contract', listCommitsResponseSchema, response.body);
        check(
          'body',
          {
            snapshot: {
              tipOid: state.rename,
              head: {
                kind: 'attached',
                ref: `refs/heads/${session.fixture.branch}`,
              },
            },
            commits: [
              {
                oid: state.rename,
                parentOids: [state.second],
                author,
                subject: 'Rename',
                subjectTruncated: false,
                body: null,
                bodyTruncated: false,
                refs: [session.fixture.branch],
              },
            ],
            nextAfter: [state.second],
            tip: state.rename,
            boundary: null,
            restarted: false,
          },
          response.body,
        );
      },
    }),
    defineCase({
      name: 'next pages',
      async setup(session) {
        return record(
          (await session.send(commits(session, { limit: 1 }))).body,
        );
      },
      request: (session, first) =>
        commits(session, {
          limit: 2,
          after: list(first.nextAfter).join(','),
          tip: String(first.tip),
        }),
      expect({ response, state, session, check, checkPartial }) {
        check('status', 200, response.status);
        const body = record(response.body);
        check('no new snapshot', null, body.snapshot);
        check('same tip', state.tip, body.tip);
        checkPartial(
          'commits',
          [
            { subject: 'Second commit', body: 'With a body' },
            { subject: session.fixture.initialCommit, parentOids: [] },
          ],
          body.commits,
        );
        check('end of history', null, body.nextAfter);
      },
    }),
    defineCase({
      name: 'continuing from a tip that moved',
      async setup(session) {
        return record(
          (await session.send(commits(session, { limit: 1 }))).body,
        );
      },
      request: (session, first) =>
        commits(session, {
          limit: 1,
          after: list(first.nextAfter).join(','),
          tip: unknownOid,
        }),
      expect({ response, state, check, checkPartial }) {
        check('status', 200, response.status);
        checkPartial(
          'restarts from the head',
          { restarted: true, tip: state.tip, commits: [{ subject: 'Rename' }] },
          response.body,
        );
      },
    }),
    defineCase({
      name: 'invalid input or unknown worktree',
      request: (session) => [
        commits(session, { limit: 0 }),
        commits(session, { after: 'not-an-oid' }),
        { method: 'GET', path: `/api/worktrees/${unknownWorktreeId}/commits` },
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
        check('unknown status', 404, responses[2]?.status);
        check('unknown error body', worktreeNotFound, responses[2]?.body);
      },
    }),
  ],
});
