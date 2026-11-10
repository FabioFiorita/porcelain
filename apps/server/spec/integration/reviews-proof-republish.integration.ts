import { expect } from 'vitest';
import { seedReview } from '../kit/seed-review.ts';
import {
  commitReviewFixture,
  sampleReview,
  worktreePath,
} from '../kit/requests.ts';
import { test } from '../kit/server-test.ts';

test('stored proof remains readable after its worktree source is removed', async ({
  session,
}) => {
  await commitReviewFixture(session);
  const bytes = new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  ]);
  await session.writeFile('retained.png', bytes);
  const stored = await seedReview(session, {
    ...sampleReview(session, 0, crypto.randomUUID(), crypto.randomUUID()),
    proof: {
      assets: [{ kind: 'image', title: 'Stored shot', path: 'retained.png' }],
    },
  });
  const id = stored.review?.proof.assets[0]?.id;
  if (!id) throw new Error('Expected retained proof identity');
  await session.remove('retained.png');
  const response = await session.send({
    method: 'GET',
    path: worktreePath(session, '/review/proof'),
    query: { proofId: id },
  });
  expect(response.status).toBe(200);
  expect(response.body).toEqual({
    id,
    mediaType: 'image/png',
    base64: Buffer.from(bytes).toString('base64'),
  });
});
