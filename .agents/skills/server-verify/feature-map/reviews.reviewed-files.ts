import {
  listReviewedFilesResponseSchema,
  setReviewedFilesResponseSchema,
} from '../../../../packages/contracts/src/reviews/index.ts';
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
  sampleFingerprint,
  worktreeNotFound,
  worktreePath,
  fingerprintOf,
} from '../scripts/fixture.ts';

const reviewed = (session: Session) => worktreePath(session, '/reviewed');
const staleMark = apiError(
  409,
  'Conflict',
  'The reviewed mark is based on a version of the file that has changed',
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
  ],
  intent: 'observed',
  behaviour:
    "A reviewer marks changed files as reviewed at the fingerprint they looked at. A single mark for a fingerprint that is no longer the file's, or for a file that is not a change, is a conflict. Marking many at once marks what still matches and reports each other file as stale or missing instead of failing. Unmarking is idempotent. Every answer is the worktree's full list of marks.",
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
      request: (session) => ({
        method: 'PUT',
        path: reviewed(session),
        body: {
          path: 'README.md',
          reviewed: true,
          fingerprint: sampleFingerprint,
        },
      }),
      async expect({ response, session, check, checkPartial }) {
        check('status', 200, response.status);
        checkPartial(
          'mark',
          {
            worktreeId: session.worktreeId,
            marks: [{ path: 'README.md', fingerprint: sampleFingerprint }],
          },
          response.body,
        );
        check(
          'list reads the same',
          response.body,
          (await session.send({ method: 'GET', path: reviewed(session) })).body,
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
            path: 'README.md',
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
            fingerprint: sampleFingerprint,
          },
        },
      ],
      async expect({ responses, session, check }) {
        for (const [index, response] of responses.entries()) {
          check(`request ${index + 1} status`, 409, response.status);
          check(`request ${index + 1} error body`, staleMark, response.body);
        }
        const listed = (
          await session.send({ method: 'GET', path: reviewed(session) })
        ).body;
        check('the earlier mark is kept', ['README.md'], paths(listed));
      },
    }),
    defineCase({
      name: 'mark many with partial conflicts',
      async setup(session) {
        await session.send({
          method: 'DELETE',
          path: reviewed(session),
          query: { path: 'README.md' },
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
            { path: 'README.md', fingerprint: unknownFingerprint },
            { path: 'missing.md', fingerprint: sampleFingerprint },
          ],
        },
      }),
      expect({ response, check, checkContract }) {
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
            { path: 'README.md', reason: 'stale' },
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
          'no marks remain',
          { worktreeId: session.worktreeId, marks: [] },
          responses[1]?.body,
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
            fingerprint: sampleFingerprint,
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
              fingerprint: sampleFingerprint,
            },
          },
          {
            method: 'PUT',
            path: `${path}/reviewed-bulk`,
            body: {
              files: [{ path: 'README.md', fingerprint: sampleFingerprint }],
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
