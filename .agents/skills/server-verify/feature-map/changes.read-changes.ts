import { readChangesResponseSchema } from '@porcelain/contracts/changes';
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
  blobOf,
  changes,
  fingerprintOf,
  head,
  inventory,
  workingBlobOf,
  worktreeNotFound,
  worktreePath,
} from '../scripts/fixture.ts';

const modified = (
  session: Session,
  scope: 'staged' | 'unstaged',
  oldOid: string,
  newOid: string | null,
) => ({
  scope,
  kind: 'modified',
  oldPath: session.fixture.readme.path,
  newPath: session.fixture.readme.path,
  oldMode: '100644',
  newMode: '100644',
  oldOid,
  newOid,
  supported: true,
});

export default defineFeature({
  feature: 'changes.read-changes',
  reaches: 'GET /api/worktrees/:worktreeId/changes',
  paired: true,
  intent: 'observed',
  behaviour:
    "A reviewer reads a worktree's changes: one entry per changed path with a content fingerprint and every comparison it appears in (staged, unstaged, untracked or unmerged), plus the head commit, branch, any merge in progress and a status token that later reads use to detect that the worktree moved. The fingerprint is stable while the change is and moves when it does. An unknown worktree is not found; a malformed worktree ID is invalid.",
  cases: [
    defineCase({
      name: 'the sample unstaged change',
      async setup(session) {
        return {
          head: await head(session),
          committed: await blobOf(
            session,
            `HEAD:${session.fixture.readme.path}`,
          ),
          inventory: await inventory(session),
          before: await changes(session),
        };
      },
      request: (session) => ({
        method: 'GET',
        path: worktreePath(session, '/changes'),
      }),
      expect({ response, state, session, check, checkContract }) {
        check('status', 200, response.status);
        checkContract('contract', readChangesResponseSchema, response.body);
        check(
          'body',
          {
            environmentId: state.inventory.environmentId,
            worktreeId: session.worktreeId,
            statusToken: state.before.statusToken,
            headOid: state.head,
            inProgress: null,
            mergeHeadOid: null,
            branch: {
              name: session.fixture.branch,
              upstream: null,
              ahead: 0,
              behind: 0,
            },
            changes: [
              {
                path: session.fixture.readme.path,
                fingerprint: state.before.changes[0]?.fingerprint,
                comparisons: [
                  modified(session, 'unstaged', state.committed, null),
                ],
              },
            ],
          },
          response.body,
        );
      },
    }),
    defineCase({
      name: 'staged and untracked changes',
      async setup(session) {
        const unstaged = await fingerprintOf(
          session,
          session.fixture.readme.path,
        );
        await session.git('add', session.fixture.readme.path);
        await session.writeFile('notes.txt', 'untracked\n');
        return {
          unstaged,
          committed: await blobOf(
            session,
            `HEAD:${session.fixture.readme.path}`,
          ),
          staged: await workingBlobOf(session, session.fixture.readme.path),
        };
      },
      request: (session) => ({
        method: 'GET',
        path: worktreePath(session, '/changes'),
      }),
      expect({ response, state, session, check, checkMatch, checkDiffers }) {
        check('status', 200, response.status);
        const entries = list(record(response.body).changes).map(record);
        check(
          'paths in observed order',
          ['notes.txt', session.fixture.readme.path],
          entries.map((entry) => entry.path),
        );
        check(
          'untracked notes',
          [{ scope: 'untracked', path: 'notes.txt' }],
          entries[0]?.comparisons,
        );
        checkMatch(
          'untracked files have a fingerprint',
          /^[0-9a-f]{64}$/,
          entries[0]?.fingerprint,
        );
        check(
          'staged README',
          [modified(session, 'staged', state.committed, state.staged)],
          entries[1]?.comparisons,
        );
        checkDiffers(
          'staging moves the fingerprint',
          state.unstaged,
          entries[1]?.fingerprint,
        );
      },
    }),
    defineCase({
      name: 'a merge conflict is an unmerged change',
      async setup(session) {
        const path = session.fixture.readme.path;
        await session.git('commit', '-m', 'Staged readme');
        await session.git('switch', '-c', 'other', 'HEAD~1');
        await session.writeFile(path, '# Another title\n');
        await session.git('commit', '-am', 'Retitle');
        const other = await head(session);
        await session.git('switch', session.fixture.branch);
        const merged = await session
          .git('merge', 'other')
          .then(() => 'merged')
          .catch(() => 'conflicted');
        if (merged !== 'conflicted')
          throw new Error('The merge did not conflict');
        return { other, head: await head(session) };
      },
      request: (session) => ({
        method: 'GET',
        path: worktreePath(session, '/changes'),
      }),
      expect({ response, state, session, check, checkPartial, checkContract }) {
        check('status', 200, response.status);
        checkContract('contract', readChangesResponseSchema, response.body);
        checkPartial(
          'merge in progress',
          {
            headOid: state.head,
            inProgress: 'merge',
            mergeHeadOid: state.other,
          },
          response.body,
        );
        const readme = list(record(response.body).changes)
          .map(record)
          .find((entry) => entry.path === session.fixture.readme.path);
        checkPartial(
          'the conflicted file is unmerged',
          [{ scope: 'unmerged', path: session.fixture.readme.path }],
          readme?.comparisons,
        );
      },
    }),
    defineCase({
      name: 'unknown or malformed worktree',
      request: () => [
        { method: 'GET', path: `/api/worktrees/${unknownWorktreeId}/changes` },
        { method: 'GET', path: '/api/worktrees/not-an-id/changes' },
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
