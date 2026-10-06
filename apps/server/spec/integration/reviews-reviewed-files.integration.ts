import * as Schema from 'effect/Schema';
import {
  listReviewedFilesResponseSchema,
  removeReviewedFilesResponseSchema,
  setReviewedFilesResponseSchema,
} from '@porcelain/contracts/reviews';
import { expect } from 'vitest';
import {
  apiError,
  invalidRequest,
  unknownFingerprint,
  unknownWorktreeId,
  worktreeNotFound,
} from '../kit/answers.ts';
import { fingerprintOf } from '../kit/reads.ts';
import { read, worktreePath } from '../kit/requests.ts';
import { test } from '../kit/server-test.ts';
import { list, record, type Session } from '../kit/session.ts';

const reviewed = (session: Session) => worktreePath(session, '/reviewed');
const staleMark = apiError(
  409,
  'Conflict',
  'The reviewed mark is based on a version that has changed',
);
const paths = (body: unknown) =>
  list(record(body).marks).map((mark) => record(mark).path);

test('a worktree with no reviewed marks lists none', async ({ session }) => {
  const response = await session.send({
    method: 'GET',
    path: reviewed(session),
  });

  expect(response.status).toBe(200);
  expect(response.body).toStrictEqual({
    worktreeId: session.worktreeId,
    marks: [],
  });
  expect(response.body).toEqual(
    expect.schemaMatching(
      Schema.toStandardSchemaV1(
        Schema.toEncoded(listReviewedFilesResponseSchema),
      ),
    ),
  );
});

test('marking a changed file at its fingerprint answers the full list of marks', async ({
  session,
}) => {
  const fingerprint = await fingerprintOf(session, session.fixture.readme.path);

  const response = await session.send({
    method: 'PUT',
    path: reviewed(session),
    body: {
      path: session.fixture.readme.path,
      reviewed: true,
      fingerprint,
    },
  });

  expect(response.status).toBe(200);
  expect(response.body).toMatchObject({
    worktreeId: session.worktreeId,
    marks: [{ path: session.fixture.readme.path, fingerprint }],
  });
  expect(
    await read(session, { method: 'GET', path: reviewed(session) }),
  ).toStrictEqual(response.body);
});

test('marking at a stale fingerprint or a file that is not a change is a conflict and keeps the earlier mark', async ({
  session,
}) => {
  const responses = [
    await session.send({
      method: 'PUT',
      path: reviewed(session),
      body: {
        path: session.fixture.readme.path,
        reviewed: true,
        fingerprint: unknownFingerprint,
      },
    }),
    await session.send({
      method: 'PUT',
      path: reviewed(session),
      body: {
        path: 'missing.md',
        reviewed: true,
        fingerprint: unknownFingerprint,
      },
    }),
  ];

  for (const response of responses) {
    expect(response.status).toBe(409);
    expect(response.body).toStrictEqual(staleMark);
  }
  const listed = await read(session, {
    method: 'GET',
    path: reviewed(session),
  });
  expect(paths(listed)).toStrictEqual([session.fixture.readme.path]);
});

test('marking many at once marks what still matches and reports the others as stale or missing', async ({
  session,
}) => {
  await session.read({
    method: 'DELETE',
    path: reviewed(session),
    query: { path: session.fixture.readme.path },
  });
  await session.writeFile('notes.txt', 'untracked\n');
  const notes = await fingerprintOf(session, 'notes.txt');

  const response = await session.send({
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
  });

  expect(response.status).toBe(200);
  expect(response.body).toEqual(
    expect.schemaMatching(
      Schema.toStandardSchemaV1(
        Schema.toEncoded(setReviewedFilesResponseSchema),
      ),
    ),
  );
  const body = record(response.body);
  expect(body.marked).toStrictEqual(['notes.txt']);
  expect(body.conflicts).toStrictEqual([
    { path: session.fixture.readme.path, reason: 'stale' },
    { path: 'missing.md', reason: 'missing' },
  ]);
  expect(paths(body)).toStrictEqual(['notes.txt']);
});

test('unmarking a file twice removes its mark and answers the same the second time', async ({
  session,
}) => {
  const responses = [
    await session.send({
      method: 'DELETE',
      path: reviewed(session),
      query: { path: 'notes.txt' },
    }),
    await session.send({
      method: 'DELETE',
      path: reviewed(session),
      query: { path: 'notes.txt' },
    }),
  ];

  expect(responses.map((entry) => entry.status)).toStrictEqual([200, 200]);
  expect(responses.map((entry) => entry.body)).toStrictEqual([
    { worktreeId: session.worktreeId, marks: [] },
    { worktreeId: session.worktreeId, marks: [] },
  ]);
});

test('unmarking many at once removes each listed mark, keeps unlisted ones, and is idempotent', async ({
  session,
}) => {
  await session.writeFile('more.txt', 'untracked too\n');
  const [notes, more] = [
    await fingerprintOf(session, 'notes.txt'),
    await fingerprintOf(session, 'more.txt'),
  ];
  const marked = await read(session, {
    method: 'PUT',
    path: worktreePath(session, '/reviewed-bulk'),
    body: {
      files: [
        { path: 'notes.txt', fingerprint: notes },
        { path: 'more.txt', fingerprint: more },
      ],
    },
  });

  const responses = [];
  for (const removed of [
    ['notes.txt', 'missing.md'],
    ['notes.txt', 'more.txt'],
    ['notes.txt', 'more.txt'],
  ])
    responses.push(
      await session.send({
        method: 'DELETE',
        path: worktreePath(session, '/reviewed-bulk'),
        body: { paths: removed },
      }),
    );

  expect(paths(marked)).toStrictEqual(['more.txt', 'notes.txt']);
  expect(responses.map((entry) => entry.status)).toStrictEqual([200, 200, 200]);
  expect(responses[0]?.body).toEqual(
    expect.schemaMatching(
      Schema.toStandardSchemaV1(
        Schema.toEncoded(removeReviewedFilesResponseSchema),
      ),
    ),
  );
  expect(paths(responses[0]?.body)).toStrictEqual(['more.txt']);
  expect(responses.slice(1).map((entry) => entry.body)).toStrictEqual([
    { worktreeId: session.worktreeId, marks: [] },
    { worktreeId: session.worktreeId, marks: [] },
  ]);
  expect(
    await read(session, { method: 'GET', path: reviewed(session) }),
  ).toStrictEqual({ worktreeId: session.worktreeId, marks: [] });
});

test('unmarking many with no paths or a path outside the worktree is invalid and in an unknown worktree is not found', async ({
  session,
}) => {
  const responses = [
    await session.send({
      method: 'DELETE',
      path: worktreePath(session, '/reviewed-bulk'),
      body: { paths: [] },
    }),
    await session.send({
      method: 'DELETE',
      path: worktreePath(session, '/reviewed-bulk'),
      body: { paths: ['../outside'] },
    }),
    await session.send({
      method: 'DELETE',
      path: `/api/worktrees/${unknownWorktreeId}/reviewed-bulk`,
      body: { paths: ['README.md'] },
    }),
  ];

  expect(responses.map((entry) => entry.status)).toStrictEqual([400, 400, 404]);
  expect(responses.map((entry) => entry.body)).toStrictEqual([
    invalidRequest,
    invalidRequest,
    worktreeNotFound,
  ]);
});

test('a single mark set to not reviewed, an empty bulk mark, an unmark without a path or with a path outside the worktree is invalid', async ({
  session,
}) => {
  const responses = [
    await session.send({
      method: 'PUT',
      path: reviewed(session),
      body: {
        path: 'README.md',
        reviewed: false,
        fingerprint: unknownFingerprint,
      },
    }),
    await session.send({
      method: 'PUT',
      path: worktreePath(session, '/reviewed-bulk'),
      body: { files: [] },
    }),
    await session.send({ method: 'DELETE', path: reviewed(session) }),
    await session.send({
      method: 'DELETE',
      path: reviewed(session),
      query: { path: '../outside' },
    }),
  ];

  for (const response of responses) {
    expect(response.status).toBe(400);
    expect(response.body).toStrictEqual(invalidRequest);
  }
});

test('listing, marking, marking many and unmarking in an unknown worktree is not found', async ({
  session,
}) => {
  const path = `/api/worktrees/${unknownWorktreeId}`;

  const responses = [
    await session.send({ method: 'GET', path: `${path}/reviewed` }),
    await session.send({
      method: 'PUT',
      path: `${path}/reviewed`,
      body: {
        path: 'README.md',
        reviewed: true,
        fingerprint: unknownFingerprint,
      },
    }),
    await session.send({
      method: 'PUT',
      path: `${path}/reviewed-bulk`,
      body: {
        files: [{ path: 'README.md', fingerprint: unknownFingerprint }],
      },
    }),
    await session.send({
      method: 'DELETE',
      path: `${path}/reviewed`,
      query: { path: 'README.md' },
    }),
  ];

  expect(responses.map((entry) => entry.status)).toStrictEqual([
    404, 404, 404, 404,
  ]);
  for (const response of responses)
    expect(response.body).toStrictEqual(worktreeNotFound);
});
