import {
  listReviewedFilesResponseSchema,
  removeReviewedFilesResponseSchema,
} from '@porcelain/contracts/reviews';
import {
  apiError,
  defineCase,
  defineFeature,
  invalidRequest,
  list,
  record,
  text,
  type Session,
} from '../scripts/feature.ts';
import { fingerprintOf, head, read, worktreePath } from '../scripts/fixture.ts';

const reviewed = (session: Session) => worktreePath(session, '/reviewed');
const base = 'refs/heads/main';
const staleMark = apiError(
  409,
  'Conflict',
  'The reviewed mark is based on a version that has changed',
);
const paths = (body: unknown) =>
  list(record(body).marks).map((mark) => record(mark).path);

async function branchFingerprint(session: Session, path: string) {
  const body = await read(session, {
    method: 'GET',
    path: worktreePath(session, '/branch-changes'),
  });
  const file = list(body.files).find((entry) => record(entry).path === path);
  return text(record(file).fingerprint);
}

const branchMarks = (session: Session) =>
  read(session, {
    method: 'GET',
    path: reviewed(session),
    query: { scope: 'branch' },
  });

const worktreeMarks = (session: Session) =>
  read(session, { method: 'GET', path: reviewed(session) });

export default defineFeature({
  feature: 'reviews.branch-reviewed-files',
  reaches: [
    'GET /api/worktrees/:worktreeId/reviewed',
    'PUT /api/worktrees/:worktreeId/reviewed',
    'PUT /api/worktrees/:worktreeId/reviewed-bulk',
    'DELETE /api/worktrees/:worktreeId/reviewed',
    'DELETE /api/worktrees/:worktreeId/reviewed-bulk',
  ],
  paired: true,
  intent: 'intended',
  behaviour:
    'A reviewer marks files of the branch review as reviewed at the fingerprint the branch comparison showed, naming the base it was read against; the server compares the branch again before it keeps the mark. Branch marks and working-tree marks are kept apart, so marking a file in one never changes its mark in the other. A branch mark goes stale when a new commit changes the file on the branch, not when the file is edited without committing. A mark for a fingerprint the branch no longer has, or a file the branch did not change, is a conflict, and marking many reports each of those instead of failing. Unmarking in the branch scope leaves the working-tree marks alone.',
  cases: [
    defineCase({
      name: 'mark a branch file at the fingerprint shown',
      async setup(session) {
        await session.git('switch', '-c', 'feature');
        await session.git('commit', '-am', 'Change the readme');
        await session.writeFile('notes.md', 'notes\n');
        await session.git('add', 'notes.md');
        await session.git('commit', '-m', 'Add notes');
        return branchFingerprint(session, 'notes.md');
      },
      request: (session, fingerprint) => ({
        method: 'PUT',
        path: reviewed(session),
        body: {
          path: 'notes.md',
          reviewed: true,
          fingerprint,
          scope: 'branch',
          base,
        },
      }),
      async expect({ response, state, session, check, checkPartial }) {
        check('status', 200, response.status);
        checkPartial(
          'the branch mark',
          {
            worktreeId: session.worktreeId,
            marks: [{ path: 'notes.md', fingerprint: state }],
          },
          response.body,
        );
        check(
          'the branch list reads the same',
          response.body,
          await branchMarks(session),
        );
        check(
          'the working-tree list is untouched',
          { worktreeId: session.worktreeId, marks: [] },
          await worktreeMarks(session),
        );
      },
    }),
    defineCase({
      name: 'one path marked in both scopes keeps both marks',
      async setup(session) {
        await session.writeFile(session.fixture.readme.path, 'uncommitted\n');
        return {
          worktree: await fingerprintOf(session, session.fixture.readme.path),
          branch: await branchFingerprint(session, session.fixture.readme.path),
        };
      },
      request: (session, state) => [
        {
          method: 'PUT',
          path: reviewed(session),
          body: {
            path: session.fixture.readme.path,
            reviewed: true,
            fingerprint: state.worktree,
          },
        },
        {
          method: 'PUT',
          path: reviewed(session),
          body: {
            path: session.fixture.readme.path,
            reviewed: true,
            fingerprint: state.branch,
            scope: 'branch',
            base,
          },
        },
      ],
      async expect({ responses, state, session, check, checkContract }) {
        check(
          'statuses',
          [200, 200],
          responses.map((entry) => entry.status),
        );
        checkContract(
          'contract',
          listReviewedFilesResponseSchema,
          responses[1]?.body,
        );
        check(
          'the working-tree mark',
          [session.fixture.readme.path],
          paths(responses[0]?.body),
        );
        check(
          'the branch marks',
          [session.fixture.readme.path, 'notes.md'],
          paths(responses[1]?.body),
        );
        const branch = list((await branchMarks(session)).marks);
        check(
          'the branch readme mark holds the branch fingerprint',
          state.branch,
          record(branch[0]).fingerprint,
        );
        const worktree = list((await worktreeMarks(session)).marks);
        check(
          'the working-tree readme mark holds the working-tree fingerprint',
          state.worktree,
          record(worktree[0]).fingerprint,
        );
      },
    }),
    defineCase({
      name: 'an uncommitted edit leaves the branch fingerprint alone',
      async setup(session) {
        const before = await branchFingerprint(session, 'notes.md');
        await session.writeFile('notes.md', 'edited without committing\n');
        return before;
      },
      request: (session) => ({
        method: 'GET',
        path: worktreePath(session, '/branch-changes'),
      }),
      expect({ response, state, check }) {
        check('status', 200, response.status);
        check(
          'the notes fingerprint',
          state,
          record(
            list(record(response.body).files).find(
              (entry) => record(entry).path === 'notes.md',
            ),
          ).fingerprint,
        );
      },
    }),
    defineCase({
      name: 'a new commit makes the branch mark stale',
      async setup(session) {
        const before = await branchFingerprint(session, 'notes.md');
        await session.git('commit', '-am', 'Change the notes');
        return {
          before,
          after: await branchFingerprint(session, 'notes.md'),
          tip: await head(session),
        };
      },
      request: (session, state) => [
        {
          method: 'PUT',
          path: reviewed(session),
          body: {
            path: 'notes.md',
            reviewed: true,
            fingerprint: state.before,
            scope: 'branch',
            base,
          },
        },
        {
          method: 'PUT',
          path: worktreePath(session, '/reviewed-bulk'),
          body: {
            files: [
              { path: 'notes.md', fingerprint: state.after },
              { path: session.fixture.readme.path, fingerprint: state.before },
              { path: 'untouched.md', fingerprint: state.before },
            ],
            scope: 'branch',
            base,
          },
        },
      ],
      async expect({ responses, state, session, check, checkDiffers }) {
        check('stale status', 409, responses[0]?.status);
        check('stale error body', staleMark, responses[0]?.body);
        check('bulk status', 200, responses[1]?.status);
        const bulk = record(responses[1]?.body);
        check('marked', ['notes.md'], bulk.marked);
        check(
          'conflicts',
          [
            { path: session.fixture.readme.path, reason: 'stale' },
            { path: 'untouched.md', reason: 'missing' },
          ],
          bulk.conflicts,
        );
        checkDiffers(
          'the commit moved the fingerprint',
          state.before,
          record(list(bulk.marks)[1]).fingerprint,
        );
      },
    }),
    defineCase({
      name: 'unmark in the branch scope only',
      request: (session) => [
        {
          method: 'DELETE',
          path: reviewed(session),
          query: { path: 'notes.md', scope: 'branch' },
        },
        {
          method: 'DELETE',
          path: worktreePath(session, '/reviewed-bulk'),
          body: { paths: [session.fixture.readme.path], scope: 'branch' },
        },
      ],
      async expect({ responses, session, check, checkContract }) {
        check(
          'statuses',
          [200, 200],
          responses.map((entry) => entry.status),
        );
        checkContract(
          'contract',
          removeReviewedFilesResponseSchema,
          responses[0]?.body,
        );
        check(
          'one branch mark is left after the first',
          [session.fixture.readme.path],
          paths(responses[0]?.body),
        );
        check(
          'no branch mark is left',
          { worktreeId: session.worktreeId, marks: [] },
          responses[1]?.body,
        );
        check(
          'the working-tree mark stays',
          [session.fixture.readme.path],
          paths(await worktreeMarks(session)),
        );
      },
    }),
    defineCase({
      name: 'a branch mark without a base or against a missing one',
      setup: (session) => branchFingerprint(session, 'notes.md'),
      request: (session, fingerprint) => [
        {
          method: 'PUT',
          path: reviewed(session),
          body: {
            path: 'notes.md',
            reviewed: true,
            fingerprint,
            scope: 'branch',
          },
        },
        {
          method: 'PUT',
          path: reviewed(session),
          body: {
            path: 'notes.md',
            reviewed: true,
            fingerprint,
            scope: 'branch',
            base: 'refs/heads/nope',
          },
        },
        {
          method: 'GET',
          path: reviewed(session),
          query: { scope: 'elsewhere' },
        },
      ],
      expect({ responses, check }) {
        check('no base status', 400, responses[0]?.status);
        check('no base error body', invalidRequest, responses[0]?.body);
        check('missing base status', 404, responses[1]?.status);
        check(
          'missing base error body',
          apiError(404, 'Not Found', 'Base branch not found'),
          responses[1]?.body,
        );
        check('unknown scope status', 400, responses[2]?.status);
        check('unknown scope error body', invalidRequest, responses[2]?.body);
      },
    }),
  ],
});
