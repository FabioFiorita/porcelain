import { expect, it } from 'vitest';
import { retainedReviewRoute } from './retained-review-route.ts';

it.each([
  ['(files)', '/(files)/retained-review/[reviewId]'],
  ['(history)', '/(history)/retained-review/[reviewId]'],
  ['(review)', '/(review)/reviews/[reviewId]'],
  [undefined, '/(review)/reviews/[reviewId]'],
])('keeps a retained review in its opening stack: %s', (group, route) => {
  expect(retainedReviewRoute(group)).toBe(route);
});
