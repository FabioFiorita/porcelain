import {
  listReviewedFilesResponseSchema,
  removeReviewedFilesResponseSchema,
  setReviewedFilesResponseSchema,
} from '@porcelain/contracts/reviews';
import {
  apiError,
  defineCase,
  defineFeature,
  invalidRequest,
  list,
  record,
  unknownFingerprint,
  unknownWorktreeId,
  type Session,
} from '../scripts/feature.ts';
import {
  fingerprintOf,
  read,
  worktreeNotFound,
  worktreePath,
} from '../scripts/fixture.ts';

const reviewed = (session: Session) => worktreePath(session, '/reviewed');
const staleMark = apiError(
  409,
  'Conflict',
  'The reviewed mark is based on a version that has changed',
);
const paths = (body: unknown) =>
  list(record(body).marks).map((mark) => record(mark).path);

export default defineFeature({
  feature: 'reviews.reviewed-files',
  reaches: [
    'GET /api/worktrees/:worktreeId/reviewed',
    'PUT /api/worktrees/:worktreeId/reviewed',
    'PUT /api/worktrees/:worktreeId/reviewed-bulk',
    'DELETE /api/worktrees/:worktreeId/reviewed',
    'DELETE /api/worktrees/:worktreeId/reviewed-bulk',
  ],
  paired: true,
  intent: 'observed',
  behaviour:
    "A reviewer marks changed files as reviewed at the fingerprint they looked at. A single mark for a fingerprint that is no longer the file's, or for a file that is not a change, is a conflict. Marking many at once marks what still matches and reports each other file as stale or missing instead of failing. Unmarking one file or many at once is idempotent, and unmarking many removes each listed mark in one write. Every answer is the worktree's full list of marks.",
  cases: [
    defineCase({
      name: 'no marks yet',
      request: (session) => ({ method: 'GET', path: reviewed(session) }),
      expect({ response, session, check, checkContract }) {
        check('status', 200, response.status);
        check(
          'body',
          { worktreeId: session.worktreeId, marks: [] },
          response.body,
        );
        checkContract(
          'contract',
          listReviewedFilesResponseSchema,
          response.body,
        );
      },
    }),
    defineCase({
      name: 'mark the sample change',
      setup: (session) => fingerprintOf(session, session.fixture.readme.path),
      request: (session, fingerprint) => ({
        method: 'PUT',
        path: reviewed(session),
        body: {
          path: session.fixture.readme.path,
          reviewed: true,
          fingerprint,
        },
      }),
      async expect({ response, state, session, check, checkPartial }) {
        check('status', 200, response.status);
        checkPartial(
          'mark',
          {
            worktreeId: session.worktreeId,
            marks: [{ path: session.fixture.readme.path, fingerprint: state }],
          },
          response.body,
        );
        check(
          'list reads the same',
          response.body,
          await read(session, { method: 'GET', path: reviewed(session) }),
        );
      },
    }),
    defineCase({
      name: 'stale fingerprint or a file that is not a change',
      request: (session) => [
        {
          method: 'PUT',
          path: reviewed(session),
          body: {
            path: session.fixture.readme.path,
            reviewed: true,
            fingerprint: unknownFingerprint,
          },
        },
        {
          method: 'PUT',
          path: reviewed(session),
          body: {
            path: 'missing.md',
            reviewed: true,
            fingerprint: unknownFingerprint,
          },
        },
      ],
      async expect({ responses, session, check }) {
        for (const [index, response] of responses.entries()) {
          check(`request ${index + 1} status`, 409, response.status);
          check(`request ${index + 1} error body`, staleMark, response.body);
        }
        const listed = await read(session, {
          method: 'GET',
          path: reviewed(session),
        });
        check(
          'the earlier mark is kept',
          [session.fixture.readme.path],
          paths(listed),
        );
      },
    }),
    defineCase({
      name: 'mark many with partial conflicts',
      async setup(session) {
        await session.read({
          method: 'DELETE',
          path: reviewed(session),
          query: { path: session.fixture.readme.path },
        });
        await session.writeFile('notes.txt', 'untracked\n');
        return fingerprintOf(session, 'notes.txt');
      },
      request: (session, notes) => ({
        method: 'PUT',
        path: worktreePath(session, '/reviewed-bulk'),
        body: {
          files: [
            { path: 'notes.txt', fingerprint: notes },
            {
              path: session.fixture.readme.path,
              fingerprint: unknownFingerprint,
            },
            { path: 'missing.md', fingerprint: unknownFingerprint },
          ],
        },
      }),
      expect({ response, session, check, checkContract }) {
        check('status', 200, response.status);
        checkContract(
          'contract',
          setReviewedFilesResponseSchema,
          response.body,
        );
        const body = record(response.body);
        check('marked', ['notes.txt'], body.marked);
        check(
          'conflicts',
          [
            { path: session.fixture.readme.path, reason: 'stale' },
            { path: 'missing.md', reason: 'missing' },
          ],
          body.conflicts,
        );
        check('marks', ['notes.txt'], paths(body));
      },
    }),
    defineCase({
      name: 'unmark twice',
      request: (session) => [
        {
          method: 'DELETE',
          path: reviewed(session),
          query: { path: 'notes.txt' },
        },
        {
          method: 'DELETE',
          path: reviewed(session),
          query: { path: 'notes.txt' },
        },
      ],
      expect({ responses, session, check }) {
        check(
          'statuses',
          [200, 200],
          responses.map((entry) => entry.status),
        );
        check(
          'no marks remain, and unmarking again answers the same',
          [
            { worktreeId: session.worktreeId, marks: [] },
            { worktreeId: session.worktreeId, marks: [] },
          ],
          responses.map((entry) => entry.body),
        );
      },
    }),
    defineCase({
      name: 'unmark many at once',
      async setup(session) {
        await session.writeFile('more.txt', 'untracked too\n');
        const [notes, more] = [
          await fingerprintOf(session, 'notes.txt'),
          await fingerprintOf(session, 'more.txt'),
        ];
        return read(session, {
          method: 'PUT',
          path: worktreePath(session, '/reviewed-bulk'),
          body: {
            files: [
              { path: 'notes.txt', fingerprint: notes },
              { path: 'more.txt', fingerprint: more },
            ],
          },
        });
      },
      request: (session) => [
        {
          method: 'DELETE',
          path: worktreePath(session, '/reviewed-bulk'),
          body: { paths: ['notes.txt', 'missing.md'] },
        },
        {
          method: 'DELETE',
          path: worktreePath(session, '/reviewed-bulk'),
          body: { paths: ['notes.txt', 'more.txt'] },
        },
        {
          method: 'DELETE',
          path: worktreePath(session, '/reviewed-bulk'),
          body: { paths: ['notes.txt', 'more.txt'] },
        },
      ],
      async expect({ responses, state, session, check, checkContract }) {
        check(
          'both files were marked',
          ['more.txt', 'notes.txt'],
          paths(state),
        );
        check(
          'statuses',
          [200, 200, 200],
          responses.map((entry) => entry.status),
        );
        checkContract(
          'contract',
          removeReviewedFilesResponseSchema,
          responses[0]?.body,
        );
        check(
          'the listed mark goes and the unlisted one stays',
          ['more.txt'],
          paths(responses[0]?.body),
        );
        check(
          'the rest go, and unmarking them again answers the same',
          [
            { worktreeId: session.worktreeId, marks: [] },
            { worktreeId: session.worktreeId, marks: [] },
          ],
          responses.slice(1).map((entry) => entry.body),
        );
        check(
          'list reads the same',
          { worktreeId: session.worktreeId, marks: [] },
          await read(session, { method: 'GET', path: reviewed(session) }),
        );
      },
    }),
    defineCase({
      name: 'invalid or unknown bulk unmark',
      request: (session) => [
        {
          method: 'DELETE',
          path: worktreePath(session, '/reviewed-bulk'),
          body: { paths: [] },
        },
        {
          method: 'DELETE',
          path: worktreePath(session, '/reviewed-bulk'),
          body: { paths: ['../outside'] },
        },
        {
          method: 'DELETE',
          path: `/api/worktrees/${unknownWorktreeId}/reviewed-bulk`,
          body: { paths: ['README.md'] },
        },
      ],
      expect({ responses, check }) {
        check(
          'statuses',
          [400, 400, 404],
          responses.map((entry) => entry.status),
        );
        check(
          'error bodies',
          [invalidRequest, invalidRequest, worktreeNotFound],
          responses.map((entry) => entry.body),
        );
      },
    }),
    defineCase({
      name: 'invalid input',
      request: (session) => [
        {
          method: 'PUT',
          path: reviewed(session),
          body: {
            path: 'README.md',
            reviewed: false,
            fingerprint: unknownFingerprint,
          },
        },
        {
          method: 'PUT',
          path: worktreePath(session, '/reviewed-bulk'),
          body: { files: [] },
        },
        { method: 'DELETE', path: reviewed(session) },
        {
          method: 'DELETE',
          path: reviewed(session),
          query: { path: '../outside' },
        },
      ],
      expect({ responses, check }) {
        for (const [index, response] of responses.entries()) {
          check(`request ${index + 1} status`, 400, response.status);
          check(
            `request ${index + 1} error body`,
            invalidRequest,
            response.body,
          );
        }
      },
    }),
    defineCase({
      name: 'unknown worktree',
      request: () => {
        const path = `/api/worktrees/${unknownWorktreeId}`;
        return [
          { method: 'GET', path: `${path}/reviewed` },
          {
            method: 'PUT',
            path: `${path}/reviewed`,
            body: {
              path: 'README.md',
              reviewed: true,
              fingerprint: unknownFingerprint,
            },
          },
          {
            method: 'PUT',
            path: `${path}/reviewed-bulk`,
            body: {
              files: [{ path: 'README.md', fingerprint: unknownFingerprint }],
            },
          },
          {
            method: 'DELETE',
            path: `${path}/reviewed`,
            query: { path: 'README.md' },
          },
        ];
      },
      expect({ responses, check }) {
        check(
          'statuses',
          [404, 404, 404, 404],
          responses.map((entry) => entry.status),
        );
        for (const [index, response] of responses.entries())
          check(
            `request ${index + 1} error body`,
            worktreeNotFound,
            response.body,
          );
      },
    }),
  ],
});
