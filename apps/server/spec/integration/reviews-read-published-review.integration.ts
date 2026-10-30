import { readPublishedReviewResponseSchema } from '@porcelain/contracts/reviews';
import * as Schema from 'effect/Schema';
import { randomUUID } from 'node:crypto';
import { expect } from 'vitest';
import {
  commitReviewFixture,
  read,
  sampleReview,
  worktreePath,
} from '../kit/requests.ts';
import { test } from '../kit/server-test.ts';
import { list, record } from '../kit/session.ts';

function withoutSummaryUrl(body: unknown) {
  const review = record(record(body).review);
  const summary = Object.fromEntries(
    Object.entries(record(review.summary)).filter(([key]) => key !== 'url'),
  );
  return { ...review, summary };
}

test('reading the review before anything is published answers null', async ({
  session,
}) => {
  await commitReviewFixture(session);
  const response = await session.send({
    method: 'GET',
    path: worktreePath(session, '/review'),
  });

  expect(response.status).toBe(200);
  expect(response.body).toStrictEqual({ review: null });
  expect(response.body).toEqual(
    expect.schemaMatching(
      Schema.toStandardSchemaV1(
        Schema.toEncoded(readPublishedReviewResponseSchema),
      ),
    ),
  );
});

test('reading a published review adds the live code comparison and a freshly signed summary link', async ({
  session,
}) => {
  const publishedAnswer = await read(session, {
    method: 'PUT',
    path: worktreePath(session, '/review'),
    body: sampleReview(session, 0, randomUUID(), randomUUID()),
  });

  const response = await session.send({
    method: 'GET',
    path: worktreePath(session, '/review'),
  });

  expect(response.status).toBe(200);
  const published = withoutSummaryUrl(publishedAnswer);
  expect(withoutSummaryUrl(response.body)).toStrictEqual({
    ...published,
    layers: list(record(publishedAnswer.review).layers).map((layer) => ({
      ...record(layer),
      codeMoved: false,
    })),
  });
  expect(record(record(record(response.body).review).summary).url).toMatch(
    /^\/review-summaries\/[0-9a-f-]{36}\?expires=[^&]+&signature=[A-Za-z0-9_-]{43}$/,
  );
});
