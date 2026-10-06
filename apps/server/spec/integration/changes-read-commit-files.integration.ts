import * as Schema from 'effect/Schema';
import { readCommitFilesResponseSchema } from '@porcelain/contracts/changes';
import { expect } from 'vitest';
import {
  apiError,
  invalidRequest,
  unknownOid,
  unknownWorktreeId,
  worktreeNotFound,
} from '../kit/answers.ts';
import { threeCommits } from '../kit/reads.ts';
import { worktreePath } from '../kit/requests.ts';
import { test } from '../kit/server-test.ts';
import { record, type HttpRequest, type Session } from '../kit/session.ts';

function files(
  session: Session,
  oid: string,
  query?: Record<string, number>,
): HttpRequest {
  return {
    method: 'GET',
    path: worktreePath(session, `/commits/${oid}/files`),
    ...(query ? { query } : {}),
  };
}

test('the files of a commit are compared with its first parent and include a rename', async ({
  session,
}) => {
  const state = await threeCommits(session);

  const response = await session.send(files(session, state.rename));

  expect(response.status).toBe(200);
  expect(response.body).toEqual(
    expect.schemaMatching(
      Schema.toStandardSchemaV1(
        Schema.toEncoded(readCommitFilesResponseSchema),
      ),
    ),
  );
  expect(record(response.body).commit).toMatchObject({
    oid: state.rename,
    subject: 'Rename',
  });
  expect(record(response.body).comparison).toStrictEqual({
    kind: 'parent',
    parentNumber: 1,
    baseOid: state.second,
  });
  expect(record(response.body).files).toStrictEqual([
    {
      oldPath: session.fixture.readme.path,
      newPath: 'GUIDE.md',
      status: 'renamed',
      oldMode: '100644',
      newMode: '100644',
    },
  ]);
});

test('the files of a root commit are compared with the empty tree', async ({
  session,
}) => {
  const root = (
    await session.git('rev-list', '--max-parents=0', 'HEAD')
  ).trim();

  const response = await session.send(files(session, root));

  expect(response.status).toBe(200);
  expect(record(response.body).comparison).toStrictEqual({
    kind: 'empty-tree',
  });
  expect(record(response.body).files).toStrictEqual([
    {
      oldPath: null,
      newPath: session.fixture.readme.path,
      status: 'added',
      oldMode: '000000',
      newMode: '100644',
    },
  ]);
});

test('the files of a commit against a parent it does not have are an invalid history request', async ({
  session,
}) => {
  const head = (await session.git('rev-parse', 'HEAD')).trim();

  const response = await session.send(files(session, head, { parent: 2 }));

  expect(response.status).toBe(400);
  expect(response.body).toStrictEqual(
    apiError(400, 'Bad Request', 'Invalid history request'),
  );
});

test('the files of an unknown commit are not found, a malformed commit id is refused, and an unknown worktree is not found', async ({
  session,
}) => {
  const responses = [
    await session.send(files(session, unknownOid)),
    await session.send(files(session, 'abc')),
    await session.send({
      method: 'GET',
      path: `/api/worktrees/${unknownWorktreeId}/commits/${unknownOid}/files`,
    }),
  ];

  expect(responses[0]?.status).toBe(404);
  expect(responses[0]?.body).toStrictEqual(
    apiError(404, 'Not Found', 'Commit not found'),
  );
  expect(responses[1]?.status).toBe(400);
  expect(responses[1]?.body).toStrictEqual(invalidRequest);
  expect(responses[2]?.status).toBe(404);
  expect(responses[2]?.body).toStrictEqual(worktreeNotFound);
});
