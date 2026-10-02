import { randomUUID } from 'node:crypto';
import { expect } from 'vitest';
import { unreadablePath } from '../kit/answers.ts';
import { sampleReview, worktreePath } from '../kit/requests.ts';
import { test } from '../kit/server-test.ts';

const LONG_NAME = `${'n'.repeat(300)}.png`;

test('reading a name longer than the file system allows is refused as unreadable', async ({
  session,
}) => {
  const response = await session.send({
    method: 'GET',
    path: worktreePath(session, '/text'),
    query: { path: LONG_NAME },
  });

  expect(response.status).toBe(422);
  expect(response.body).toStrictEqual(unreadablePath);
});

test('publishing a review whose proof names a file longer than the file system allows is refused as an unreadable proof file', async ({
  session,
}) => {
  const response = await session.send({
    method: 'PUT',
    path: worktreePath(session, '/review'),
    body: {
      ...sampleReview(session, 0, randomUUID(), randomUUID()),
      proof: {
        assets: [{ kind: 'image', title: 'Shot', path: LONG_NAME }],
      },
    },
  });

  expect(response.status).toBe(422);
  expect(response.body).toStrictEqual({
    statusCode: 422,
    error: 'Unprocessable Entity',
    message:
      'A proof file is missing from the worktree or is not a readable file',
  });
});
