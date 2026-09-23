import { readChangesResponseSchema } from '../../../../packages/contracts/src/changes/index.ts';
import {
  defineCase,
  defineFeature,
  invalidRequest,
  list,
  record,
  unknownWorktreeId,
} from '../scripts/feature.ts';
import {
  inventory,
  worktreeNotFound,
  worktreePath,
} from '../scripts/fixture.ts';

const modifiedReadme = (
  scope: 'staged' | 'unstaged',
  newOid: string | null,
) => ({
  scope,
  kind: 'modified',
  oldPath: 'README.md',
  newPath: 'README.md',
  oldMode: '100644',
  newMode: '100644',
  oldOid: '8a6929205fe52d1251aee0bbafe362ef543d4d35',
  newOid,
  supported: true,
});

export default defineFeature({
  feature: 'changes.read-changes',
  reaches: 'GET /api/worktrees/:worktreeId/changes',
  intent: 'observed',
  behaviour:
    "A reviewer reads a worktree's changes: one entry per changed path with a content fingerprint and every comparison it appears in (staged, unstaged, untracked or unmerged), plus the head commit, branch and a status token that later reads use to detect that the worktree moved. An unknown worktree is not found; a malformed worktree ID is invalid.",
  cases: [
    defineCase({
      name: 'the sample unstaged change',
      async setup(session) {
        return {
          head: (await session.git('rev-parse', 'HEAD')).trim(),
          inventory: await inventory(session),
        };
      },
      request: (session) => ({
        method: 'GET',
        path: worktreePath(session, '/changes'),
      }),
      expect({ response, state, session, check, checkContract }) {
        check('status', 200, response.status);
        checkContract('contract', readChangesResponseSchema, response.body);
        const body = record(response.body);
        check(
          'body',
          {
            environmentId: state.inventory.environmentId,
            worktreeId: session.worktreeId,
            statusToken: body.statusToken,
            headOid: state.head,
            inProgress: null,
            mergeHeadOid: null,
            branch: { name: 'main', upstream: null, ahead: 0, behind: 0 },
            changes: [
              {
                path: 'README.md',
                fingerprint:
                  '68ae39995d04b18f57dacf53b58c6c21f44a6a9a9cd6f1085d932da25530dcce',
                comparisons: [modifiedReadme('unstaged', null)],
              },
            ],
          },
          body,
        );
      },
    }),
    defineCase({
      name: 'staged and untracked changes',
      async setup(session) {
        await session.git('add', 'README.md');
        await session.writeFile('notes.txt', 'untracked\n');
      },
      request: (session) => ({
        method: 'GET',
        path: worktreePath(session, '/changes'),
      }),
      expect({ response, check }) {
        check('status', 200, response.status);
        const changes = list(record(response.body).changes).map(record);
        check(
          'paths in observed order',
          ['notes.txt', 'README.md'],
          changes.map((entry) => entry.path),
        );
        check(
          'untracked notes',
          [{ scope: 'untracked', path: 'notes.txt' }],
          changes[0]?.comparisons,
        );
        check(
          'untracked files have a fingerprint',
          'string',
          typeof changes[0]?.fingerprint,
        );
        check(
          'staged README',
          [
            modifiedReadme(
              'staged',
              '90c68664db2f028b5c162b165a88a854c17e9acb',
            ),
          ],
          changes[1]?.comparisons,
        );
        check(
          'staging changes the fingerprint',
          true,
          changes[1]?.fingerprint !==
            '68ae39995d04b18f57dacf53b58c6c21f44a6a9a9cd6f1085d932da25530dcce',
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
