import * as Schema from 'effect/Schema';
import { listWorktreePathsResponseSchema } from '@porcelain/contracts/files';
import { expect } from 'vitest';
import {
  invalidRequest,
  unknownWorktreeId,
  worktreeNotFound,
} from '../kit/answers.ts';
import { worktreePath } from '../kit/requests.ts';
import { test } from '../kit/server-test.ts';

test('listing worktree paths answers tracked and untracked files but not ignored ones', async ({
  session,
}) => {
  await session.writeFile('.gitignore', 'build.log\n');
  await session.writeFile('build.log', 'ignored\n');
  await session.writeFile('notes.txt', 'untracked\n');

  const response = await session.send({
    method: 'GET',
    path: worktreePath(session, '/paths'),
  });

  expect(response.status).toBe(200);
  expect(response.body).toEqual(
    expect.schemaMatching(
      Schema.toStandardSchemaV1(
        Schema.toEncoded(listWorktreePathsResponseSchema),
      ),
    ),
  );
  expect(response.body).toStrictEqual({
    worktreeId: session.worktreeId,
    paths: ['.gitignore', session.fixture.readme.path, 'notes.txt'],
  });
});

test('listing the paths of an unknown worktree is not found and of a malformed worktree id is invalid input', async ({
  session,
}) => {
  const unknown = await session.send({
    method: 'GET',
    path: `/api/worktrees/${unknownWorktreeId}/paths`,
  });
  const malformed = await session.send({
    method: 'GET',
    path: '/api/worktrees/not-an-id/paths',
  });

  expect(unknown.status).toBe(404);
  expect(unknown.body).toStrictEqual(worktreeNotFound);
  expect(malformed.status).toBe(400);
  expect(malformed.body).toStrictEqual(invalidRequest);
});
