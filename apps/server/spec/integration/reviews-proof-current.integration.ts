import { randomUUID } from 'node:crypto';
import { expect } from 'vitest';
import { sampleReview, worktreePath } from '../kit/requests.ts';
import { test } from '../kit/server-test.ts';
import { record, type Session } from '../kit/session.ts';

const layerId = randomUUID();
const stepId = randomUUID();
const checks = [{ name: 'pnpm test', result: 'pass' }];
const shot = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
]);
const review = (session: Session) => ({
  method: 'GET' as const,
  path: worktreePath(session, '/review'),
});
const proofOf = (body: unknown) => record(record(record(body).review).proof);

test('proof published with a review is current', async ({ session }) => {
  const response = await session.send({
    method: 'PUT',
    path: worktreePath(session, '/review'),
    body: {
      ...sampleReview(session, 0, layerId, stepId),
      proof: { checks },
    },
  });

  expect(response.status).toBe(200);
  expect(proofOf(response.body)).toStrictEqual({
    checks,
    assets: [],
    current: true,
  });
});

test('proof is no longer current once a changed file is edited again', async ({
  session,
}) => {
  await session.writeFile(
    session.fixture.readme.path,
    `${session.fixture.readme.changed}One more line.\n`,
  );

  const response = await session.send(review(session));

  expect(response.status).toBe(200);
  expect(proofOf(response.body)).toStrictEqual({
    checks,
    assets: [],
    current: false,
  });
});

test('deleting a published screenshot from the worktree keeps the proof current', async ({
  session,
}) => {
  await session.writeFile('current-shot.png', shot);
  await session.read({
    method: 'PUT',
    path: worktreePath(session, '/review'),
    body: {
      ...sampleReview(session, 1, layerId, stepId),
      proof: {
        checks,
        assets: [{ kind: 'image', title: 'Shot', path: 'current-shot.png' }],
      },
    },
  });
  await session.remove('current-shot.png');

  const response = await session.send(review(session));

  expect(response.status).toBe(200);
  expect(proofOf(response.body)).toMatchObject({
    checks,
    assets: [{ kind: 'image', title: 'Shot' }],
    current: true,
  });
});
