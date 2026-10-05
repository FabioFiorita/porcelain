import * as Schema from 'effect/Schema';
import { readChangeLinesResponseSchema } from '@porcelain/contracts/changes';
import { expect } from 'vitest';
import {
  apiError,
  invalidRequest,
  unknownWorktreeId,
  worktreeNotFound,
} from '../kit/answers.ts';
import { worktreePath } from '../kit/requests.ts';
import { test } from '../kit/server-test.ts';
import { record, type HttpRequest, type Session } from '../kit/session.ts';

function linesOf(value: string) {
  return value.replace(/\n$/, '').split('\n');
}

function lines(
  session: Session,
  query: Record<string, string | number>,
): HttpRequest {
  return {
    method: 'GET',
    path: worktreePath(session, '/changes/lines'),
    query,
  };
}

test('reading lines returns the worktree version or the head version, clamped to the length of the file', async ({
  session,
}) => {
  const responses = [
    await session.send(
      lines(session, {
        path: session.fixture.readme.path,
        from: 1,
        to: 5,
        at: 'worktree',
      }),
    ),
    await session.send(
      lines(session, {
        path: session.fixture.readme.path,
        from: 1,
        to: 5,
        at: 'head',
      }),
    ),
  ];

  expect(responses.map((entry) => entry.status)).toStrictEqual([200, 200]);
  expect(responses[0]?.body).toEqual(
    expect.schemaMatching(
      Schema.toStandardSchemaV1(
        Schema.toEncoded(readChangeLinesResponseSchema),
      ),
    ),
  );
  const worktree = linesOf(session.fixture.readme.changed);
  const committed = linesOf(session.fixture.readme.committed);
  expect(responses[0]?.body).toMatchObject({
    worktreeId: session.worktreeId,
    at: 'worktree',
    path: session.fixture.readme.path,
    from: 1,
    to: worktree.length,
    lines: worktree,
  });
  expect(responses[1]?.body).toMatchObject({
    at: 'head',
    from: 1,
    to: committed.length,
    lines: committed,
  });
});

test('reading a line range that ends before it starts is refused', async ({
  session,
}) => {
  const response = await session.send(
    lines(session, {
      path: session.fixture.readme.path,
      from: 5,
      to: 1,
      at: 'head',
    }),
  );

  expect(response.status).toBe(400);
  expect(response.body).toStrictEqual(invalidRequest);
});

test('reading a line range past the end of the file returns an empty range that states where it starts', async ({
  session,
}) => {
  const response = await session.send(
    lines(session, {
      path: session.fixture.readme.path,
      from: 5,
      to: 9,
      at: 'head',
    }),
  );

  expect(response.status).toBe(200);
  const body = record(response.body);
  expect({ from: body.from, to: body.to, lines: body.lines }).toStrictEqual({
    from: 5,
    to: 4,
    lines: [],
  });
});

test('reading lines of a path that is not in the repository is not found, at head as in the worktree', async ({
  session,
}) => {
  const responses = [
    await session.send(
      lines(session, { path: 'missing.md', from: 1, to: 2, at: 'head' }),
    ),
    await session.send(
      lines(session, { path: 'missing.md', from: 1, to: 2, at: 'worktree' }),
    ),
  ];

  expect(responses[0]?.status).toBe(404);
  expect(responses[0]?.body).toStrictEqual(
    apiError(404, 'Not Found', 'Path not found'),
  );
  expect(responses[1]?.status).toBe(404);
  expect(responses[1]?.body).toStrictEqual(
    apiError(404, 'Not Found', 'Path not found'),
  );
});

test('reading lines from line zero, outside the worktree or at an unknown version is refused, and an unknown worktree is not found', async ({
  session,
}) => {
  const responses = [
    await session.send(
      lines(session, { path: 'README.md', from: 0, to: 2, at: 'head' }),
    ),
    await session.send(
      lines(session, { path: '../outside', from: 1, to: 2, at: 'head' }),
    ),
    await session.send(
      lines(session, { path: 'README.md', from: 1, to: 2, at: 'index' }),
    ),
    await session.send({
      method: 'GET',
      path: `/api/worktrees/${unknownWorktreeId}/changes/lines`,
      query: { path: 'README.md', from: 1, to: 2, at: 'head' },
    }),
  ];

  for (const response of responses.slice(0, 3)) {
    expect(response.status).toBe(400);
    expect(response.body).toStrictEqual(invalidRequest);
  }
  expect(responses[3]?.status).toBe(404);
  expect(responses[3]?.body).toStrictEqual(worktreeNotFound);
});
