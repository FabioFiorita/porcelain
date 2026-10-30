import { expect, it } from 'vitest';
import {
  pullRequestReviewDestination,
  reviewRouteSearch,
} from './review-route';
it('keeps the decision and paired environment in a durable browser destination', () => {
  expect(
    reviewRouteSearch({
      decision: 'layer',
      environment: 'remote',
      revision: '4',
    }),
  ).toEqual({
    entry: undefined,
    decision: 'layer',
    environment: 'remote',
  });
  expect(reviewRouteSearch({ decision: ['layer'], environment: 7 })).toEqual({
    entry: undefined,
    decision: undefined,
    environment: undefined,
  });
});

it('returns from a scoped PR to its source review and opens the requested file on the source computer', () => {
  const source = {
    kind: 'pull-request' as const,
    reviewId: 'source-review',
    number: 423,
    environmentId: 'remote-computer',
  };
  expect(
    pullRequestReviewDestination(source, 'local-computer', { kind: 'handoff' }),
  ).toEqual({
    to: '/reviews/$reviewId',
    params: { reviewId: 'source-review' },
    search: {
      environment: 'remote-computer',
      entry: 'handoff',
      decision: undefined,
    },
  });
  expect(
    pullRequestReviewDestination(source, 'local-computer', {
      kind: 'file',
      path: 'src/remote file.ts',
    }),
  ).toEqual({
    to: '/reviews/$reviewId',
    params: { reviewId: 'source-review' },
    search: {
      environment: 'remote-computer',
      entry: 'file:src/remote file.ts',
      decision: undefined,
    },
  });
  expect(
    pullRequestReviewDestination(
      { ...source, environmentId: 'local-computer' },
      'local-computer',
      { kind: 'handoff' },
    ).search.environment,
  ).toBeUndefined();
});
