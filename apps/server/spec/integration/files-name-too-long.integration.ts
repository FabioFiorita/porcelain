import { commitReviewFixture } from '../kit/requests.ts';

import { expect } from 'vitest';
import { unreadablePath } from '../kit/answers.ts';
import { worktreePath } from '../kit/requests.ts';
import { test } from '../kit/server-test.ts';

const LONG_NAME = `${'n'.repeat(300)}.png`;

test('reading a name longer than the file system allows is refused as unreadable', async ({
  session,
}) => {
  await commitReviewFixture(session);
  const response = await session.send({
    method: 'GET',
    path: worktreePath(session, '/text'),
    query: { path: LONG_NAME },
  });

  expect(response.status).toBe(422);
  expect(response.body).toStrictEqual(unreadablePath);
});
