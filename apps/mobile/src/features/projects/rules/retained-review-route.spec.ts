import { expect, it } from 'vitest';
import {
  retainedReviewRoute,
  pullRequestRoute,
} from './retained-review-route.ts';

it.each([
  ['(files)', '/(files)/retained-review/[reviewId]'],
  ['(history)', '/(history)/retained-review/[reviewId]'],
  ['(review)', '/(review)/reviews/[reviewId]'],
  [undefined, '/(review)/reviews/[reviewId]'],
])('keeps a retained review in its opening stack: %s', (group, route) => {
  expect(retainedReviewRoute(group)).toBe(route);
});

it.each([
  ['(files)', '/(files)/pull-request'],
  ['(history)', '/(history)/pull-request'],
  ['(review)', '/(review)/pull-request'],
])('keeps a pull request in its opening phone stack: %s', (group, route) => {
  expect(pullRequestRoute(group)).toBe(route);
});
