import { readChangeDiffsResponseSchema } from '@porcelain/contracts/changes';
import {
  apiError,
  defineCase,
  defineFeature,
  invalidRequest,
  unknownFingerprint,
  unknownWorktreeId,
  type Session,
} from '../scripts/feature.ts';
import {
  changes,
  fingerprintOf,
  inventory,
  worktreeNotFound,
  worktreePath,
} from '../scripts/fixture.ts';

const refresh = apiError(
  409,
  'Conflict',
  'Refresh status and retry inspection',
  'worktree_changed',
);
const unstaged = (session: Session) => ({
  scope: 'unstaged',
  oldPath: session.fixture.readme.path,
  newPath: session.fixture.readme.path,
});

async function seen(session: Session) {
  return {
    ...(await changes(session)),
    fingerprint: await fingerprintOf(session, session.fixture.readme.path),
  };
}

function diffs(
  session: Session,
  statusToken: string,
  fingerprint: string | null,
  selection: object = unstaged(session),
) {
  return {
    expectedStatusToken: statusToken,
    expectedFiles: [{ path: session.fixture.readme.path, fingerprint }],
    selections: [selection],
  };
}

export default defineFeature({
  feature: 'changes.read-change-diffs',
  reaches: 'POST /api/worktrees/:worktreeId/changes/diffs',
  paired: true,
  intent: 'intended',
  behaviour:
    'A reviewer reads the diffs of selected comparisons, stating the status token and file fingerprints it last saw, and gets the patch Git reports for each. The selections must cover exactly the stated files, otherwise the request is invalid. If the worktree moved since, the read is refused as a conflict so the client refreshes first; nothing is read from a newer state than the one the reviewer looked at.',
  cases: [
    defineCase({
      name: 'the sample change',
      async setup(session) {
        return {
          ...(await seen(session)),
          environmentId: (await inventory(session)).environmentId,
          patch: await session.git('diff', '--', session.fixture.readme.path),
        };
      },
      request: (session, state) => ({
        method: 'POST',
        path: worktreePath(session, '/changes/diffs'),
        body: diffs(session, state.statusToken, state.fingerprint),
      }),
      expect({ response, state, session, check, checkContract }) {
        check('status', 200, response.status);
        checkContract('contract', readChangeDiffsResponseSchema, response.body);
        check(
          'body',
          {
            environmentId: state.environmentId,
            worktreeId: session.worktreeId,
            statusToken: state.statusToken,
            diffs: [
              {
                selection: unstaged(session),
                content: { kind: 'text', patch: state.patch },
              },
            ],
          },
          response.body,
        );
      },
    }),
    defineCase({
      name: 'a selection that is not one of the stated files',
      setup: seen,
      request: (session, state) => ({
        method: 'POST',
        path: worktreePath(session, '/changes/diffs'),
        body: diffs(session, state.statusToken, state.fingerprint, {
          scope: 'staged',
          oldPath: 'other.md',
          newPath: 'other.md',
        }),
      }),
      expect({ response, check }) {
        check('status', 400, response.status);
        check('error body', invalidRequest, response.body);
      },
    }),
    defineCase({
      name: 'a stated file whose selection is no longer listed',
      setup: seen,
      request: (session, state) => ({
        method: 'POST',
        path: worktreePath(session, '/changes/diffs'),
        body: diffs(session, state.statusToken, state.fingerprint, {
          ...unstaged(session),
          scope: 'staged',
        }),
      }),
      expect({ response, check }) {
        check('status', 409, response.status);
        check('error body', refresh, response.body);
      },
    }),
    defineCase({
      name: 'stale status token or stale fingerprint',
      setup: seen,
      request: (session, state) => [
        {
          method: 'POST',
          path: worktreePath(session, '/changes/diffs'),
          body: diffs(session, unknownFingerprint, state.fingerprint),
        },
        {
          method: 'POST',
          path: worktreePath(session, '/changes/diffs'),
          body: diffs(session, state.statusToken, unknownFingerprint),
        },
      ],
      expect({ responses, check }) {
        for (const [index, response] of responses.entries()) {
          check(`request ${index + 1} status`, 409, response.status);
          check(`request ${index + 1} error body`, refresh, response.body);
        }
      },
    }),
    defineCase({
      name: 'the worktree moved after the status was read',
      async setup(session) {
        const before = await seen(session);
        await session.writeFile(session.fixture.readme.path, 'Edited again\n');
        return before;
      },
      request: (session, state) => ({
        method: 'POST',
        path: worktreePath(session, '/changes/diffs'),
        body: diffs(session, state.statusToken, state.fingerprint),
      }),
      expect({ response, check }) {
        check('status', 409, response.status);
        check('error body', refresh, response.body);
      },
    }),
    defineCase({
      name: 'invalid input or unknown worktree',
      setup: changes,
      request: (session, state) => [
        {
          method: 'POST',
          path: worktreePath(session, '/changes/diffs'),
          body: {
            expectedStatusToken: state.statusToken,
            expectedFiles: [],
            selections: [],
          },
        },
        {
          method: 'POST',
          path: `/api/worktrees/${unknownWorktreeId}/changes/diffs`,
          body: diffs(session, state.statusToken, null),
        },
      ],
      expect({ responses, check }) {
        check('invalid status', 400, responses[0]?.status);
        check('invalid error body', invalidRequest, responses[0]?.body);
        check('unknown status', 404, responses[1]?.status);
        check('unknown error body', worktreeNotFound, responses[1]?.body);
      },
    }),
  ],
});
