import { Schema } from 'effect';
import { deleteReviewResponseSchema } from '@porcelain/contracts/reviews';
import { randomUUID } from 'node:crypto';
import { expect } from 'vitest';
import { test } from '../kit/server-test.ts';
import {
  read,
  sampleReview,
  toolCall,
  toolValue,
  worktreePath,
} from '../kit/requests.ts';
import { record } from '../kit/session.ts';
import { unknownWorktreeId, worktreeNotFound } from '../kit/answers.ts';

for (const surface of ['HTTP', 'MCP'] as const)
  test(`${surface} deletes the review finally, is idempotent and allows a new publish at revision zero`, async ({
    session,
  }) => {
    const path = worktreePath(session, '/review');
    const draft = sampleReview(session, 0, randomUUID(), randomUUID());
    const published = await read(session, { method: 'PUT', path, body: draft });
    expect(record(published.review).revision).toBe(1);
    const remove = async (id: number) =>
      surface === 'HTTP'
        ? read(session, { method: 'DELETE', path })
        : toolValue(
            await read(session, toolCall(session, id, 'delete_review', {})),
          );
    const removed = await remove(1);
    expect(removed).toEqual(
      expect.schemaMatching(
        Schema.toStandardSchemaV1(Schema.toEncoded(deleteReviewResponseSchema)),
      ),
    );
    expect(removed).toEqual({ deleted: true });
    expect(await read(session, { method: 'GET', path })).toEqual({
      review: null,
    });
    expect(
      toolValue(await read(session, toolCall(session, 2, 'read_review', {}))),
    ).toEqual({ review: null });
    expect(await remove(3)).toEqual({ deleted: false });
    const republished =
      surface === 'HTTP'
        ? await read(session, { method: 'PUT', path, body: draft })
        : record(
            toolValue(
              await read(
                session,
                toolCall(session, 4, 'publish_review', draft),
              ),
            ),
          );
    expect(record(republished.review).revision).toBe(1);
    expect(record(republished.review).active).toBe(true);
    const conflict = await session.send({ method: 'PUT', path, body: draft });
    expect(conflict.status).toBe(409);
    expect(await read(session, { method: 'DELETE', path })).toEqual({
      deleted: true,
    });
  });

test('deleting an unknown worktree uses the sibling worktree failure', async ({
  session,
}) => {
  const response = await session.send({
    method: 'DELETE',
    path: `/api/worktrees/${unknownWorktreeId}/review`,
  });
  expect(response.status).toBe(404);
  expect(response.body).toEqual(worktreeNotFound);
});
