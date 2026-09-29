import {
  listBranchBasesResponseSchema,
  readBranchChangesResponseSchema,
} from '@porcelain/contracts/changes';
import {
  apiError,
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
  head,
  worktreeNotFound,
  worktreePath,
} from '../scripts/fixture.ts';

const branchChanges = (session: Session, base?: string) => ({
  method: 'GET' as const,
  path: worktreePath(session, '/branch-changes'),
  ...(base === undefined ? {} : { query: { base } }),
});

const fileAt = (body: unknown, index: number) =>
  list(record(body).files)[index];

async function forkFeature(session: Session) {
  const fork = await head(session);
  await session.git('switch', '-c', 'feature');
  await session.git('commit', '-am', 'Change the readme');
  await session.writeFile('notes.md', 'notes\n');
  await session.git('add', 'notes.md');
  await session.git('commit', '-m', 'Add notes');
  await session.git('switch', session.fixture.branch);
  await session.writeFile('main-only.md', 'main\n');
  await session.git('add', 'main-only.md');
  await session.git('commit', '-m', 'Main moves on');
  const main = await head(session);
  await session.git('switch', 'feature');
  await session.git('branch', 'fork-point', fork);
  return { fork, main, tip: await head(session) };
}

export default defineFeature({
  feature: 'changes.read-branch-changes',
  reaches: [
    'GET /api/worktrees/:worktreeId/branch-changes',
    'GET /api/worktrees/:worktreeId/branch-bases',
  ],
  paired: true,
  intent: 'intended',
  behaviour:
    "A reviewer lists every file the checked-out branch changed since it forked from a base, like a pull request: the base is the repository's default branch unless a local or remote branch is chosen, the comparison starts at the merge base so what the base did after the fork is left out, and each file carries a fingerprint of both of its sides. Work not yet committed is not part of the branch. The reviewer can list the branches to choose a base from, with the default named. A base that does not exist is not found, a base that is not a plain branch ref is refused, and a branch with no commits or no history in common with its base cannot be compared. Without a default branch the answer has no base and no files.",
  cases: [
    defineCase({
      name: 'files the branch changed since it forked from the default branch',
      setup: forkFeature,
      request: (session) => branchChanges(session),
      expect({
        response,
        state,
        session,
        check,
        checkPartial,
        checkMatch,
        checkContract,
      }) {
        check('status', 200, response.status);
        checkContract(
          'contract',
          readBranchChangesResponseSchema,
          response.body,
        );
        const body = record(response.body);
        check(
          'head',
          { oid: state.tip, branch: 'refs/heads/feature' },
          body.head,
        );
        check(
          'base',
          { ref: `refs/heads/${session.fixture.branch}`, oid: state.main },
          body.base,
        );
        check('merge base', state.fork, body.mergeBaseOid);
        check('commits on the branch', 2, body.commits);
        check('file count', 2, list(body.files).length);
        checkPartial(
          'the readme change',
          {
            path: session.fixture.readme.path,
            oldPath: session.fixture.readme.path,
            newPath: session.fixture.readme.path,
            status: 'modified',
            oldMode: '100644',
            newMode: '100644',
          },
          fileAt(response.body, 0),
        );
        checkPartial(
          'the added notes',
          {
            path: 'notes.md',
            oldPath: null,
            newPath: 'notes.md',
            status: 'added',
            oldMode: '000000',
            newMode: '100644',
          },
          fileAt(response.body, 1),
        );
        checkMatch(
          'fingerprint',
          /^[a-f0-9]{64}$/u,
          record(fileAt(response.body, 0)).fingerprint,
        );
      },
    }),
    defineCase({
      name: 'a chosen base branch',
      setup: async (session) => ({
        fork: await blobOf(session, 'fork-point'),
        tip: await head(session),
      }),
      request: (session) => [
        branchChanges(session, 'refs/heads/fork-point'),
        branchChanges(session, 'refs/heads/feature'),
      ],
      expect({ responses, state, check }) {
        check(
          'statuses',
          [200, 200],
          responses.map((entry) => entry.status),
        );
        check(
          'fork point base',
          { ref: 'refs/heads/fork-point', oid: state.fork },
          record(responses[0]?.body).base,
        );
        check(
          'fork point files',
          2,
          list(record(responses[0]?.body).files).length,
        );
        const itself = record(responses[1]?.body);
        check(
          'the branch against itself is based on its own tip',
          { ref: 'refs/heads/feature', oid: state.tip },
          itself.base,
        );
        check('its merge base is its tip', state.tip, itself.mergeBaseOid);
        check('it has no commits of its own', 0, itself.commits);
        check('it has no files', [], itself.files);
      },
    }),
    defineCase({
      name: 'branches to choose a base from',
      request: (session) => ({
        method: 'GET',
        path: worktreePath(session, '/branch-bases'),
      }),
      expect({ response, session, check, checkContract }) {
        check('status', 200, response.status);
        checkContract('contract', listBranchBasesResponseSchema, response.body);
        check(
          'bases and the default',
          {
            defaultRef: `refs/heads/${session.fixture.branch}`,
            bases: [
              {
                ref: 'refs/heads/fork-point',
                name: 'fork-point',
                remote: false,
              },
              { ref: 'refs/heads/feature', name: 'feature', remote: false },
              {
                ref: `refs/heads/${session.fixture.branch}`,
                name: session.fixture.branch,
                remote: false,
              },
            ],
          },
          response.body,
        );
      },
    }),
    defineCase({
      name: 'a base that is missing or not a plain branch',
      request: (session) => [
        branchChanges(session, 'refs/heads/nope'),
        branchChanges(session, 'main'),
        branchChanges(session, 'refs/heads/main~1'),
        {
          method: 'GET',
          path: `/api/worktrees/${unknownWorktreeId}/branch-changes`,
        },
        {
          method: 'GET',
          path: `/api/worktrees/${unknownWorktreeId}/branch-bases`,
        },
      ],
      expect({ responses, check }) {
        check('missing base status', 404, responses[0]?.status);
        check(
          'missing base error body',
          apiError(404, 'Not Found', 'Base branch not found'),
          responses[0]?.body,
        );
        check('short name status', 400, responses[1]?.status);
        check('short name error body', invalidRequest, responses[1]?.body);
        check('revision status', 400, responses[2]?.status);
        check(
          'revision error body',
          apiError(400, 'Bad Request', 'Invalid history request'),
          responses[2]?.body,
        );
        for (const [index, response] of responses.slice(3).entries()) {
          check(`unknown worktree ${index + 1} status`, 404, response.status);
          check(
            `unknown worktree ${index + 1} error body`,
            worktreeNotFound,
            response.body,
          );
        }
      },
    }),
    defineCase({
      name: 'no default branch',
      async setup(session) {
        await session.git('branch', '-m', session.fixture.branch, 'trunk');
        return head(session);
      },
      request: (session) => branchChanges(session),
      async expect({ response, state, session, check }) {
        check('status', 200, response.status);
        check(
          'no base and no files',
          {
            worktreeId: session.worktreeId,
            head: { oid: state, branch: 'refs/heads/feature' },
            base: null,
            mergeBaseOid: null,
            commits: 0,
            files: [],
          },
          response.body,
        );
        await session.git('branch', '-m', 'trunk', session.fixture.branch);
      },
    }),
    defineCase({
      name: 'a branch with no commits, then no shared history',
      setup: async (session) => {
        await session.git('switch', '--orphan', 'island');
      },
      request: (session) => branchChanges(session),
      async expect({ response, session, check }) {
        check('unborn status', 409, response.status);
        check(
          'unborn error body',
          apiError(409, 'Conflict', 'The branch has no commits yet'),
          response.body,
        );
        await session.writeFile('island.md', 'island\n');
        await session.git('add', 'island.md');
        await session.git('commit', '-m', 'Island');
        const unrelated = await session.send(branchChanges(session));
        check('unrelated status', 409, unrelated.status);
        check(
          'unrelated error body',
          apiError(
            409,
            'Conflict',
            'The branch shares no history with its base',
          ),
          unrelated.body,
        );
      },
    }),
  ],
});
