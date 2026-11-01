import { expect, it } from 'vitest';
import {
  pullRequestReviewDestination,
  reviewRouteSearch,
} from './review-route';

it('restores each document URL independently without accepting malformed or oversized entries', () => {
  expect(
    reviewRouteSearch({
      entry: 'file:src/a b.ts',
      side: 'timeline:src/a b.ts',
      decision: 'chosen-decision',
      environment: 'paired-computer',
    }),
  ).toEqual({
    entry: 'file:src/a b.ts',
    side: 'timeline:src/a b.ts',
    decision: 'chosen-decision',
    environment: 'paired-computer',
  });
  expect(
    reviewRouteSearch({ entry: ['file:wrong'], side: 'file:valid.ts' }),
  ).toEqual({
    entry: undefined,
    side: 'file:valid.ts',
    decision: undefined,
    environment: undefined,
  });
  expect(reviewRouteSearch({ entry: 'x'.repeat(8193), side: 4 })).toEqual({
    entry: undefined,
    side: undefined,
    decision: undefined,
    environment: undefined,
  });
});
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
