import { Schema } from 'effect';
import { expect, it } from 'vitest';
import { publishReviewResponseSchema } from './review.ts';

const publication = {
  review: null,
  reviewId: '10000000-0000-4000-8000-000000000001',
  revision: 1,
  headOid: 'head',
  baseOid: 'base',
};
const destinations = {
  web: 'http://127.0.0.1:5090/reviews/review',
  app: 'https://porcelain.fabiofiorita.com/open/reviews/review',
  revision: { web: 'revision-web', app: 'revision-app' },
  decisions: [],
};
it.each([
  ['older server', destinations],
  ['current server', { kind: 'available', ...destinations }],
])('reads links from the %s without losing destinations', (_, links) => {
  const response = Schema.decodeUnknownSync(publishReviewResponseSchema)({
    ...publication,
    links,
  });
  expect(response.links).toEqual({ kind: 'available', ...destinations });
});
it('represents no reachable route without inventing destinations', () => {
  const response = Schema.decodeUnknownSync(publishReviewResponseSchema)({
    ...publication,
    links: { kind: 'unavailable', reason: 'no-reachable-route' },
  });
  expect(response.links).toEqual({
    kind: 'unavailable',
    reason: 'no-reachable-route',
  });
});
it('rejects an unknown route availability', () => {
  expect(() =>
    Schema.decodeUnknownSync(publishReviewResponseSchema)({
      ...publication,
      links: { kind: 'unknown', ...destinations },
    }),
  ).toThrow();
});
