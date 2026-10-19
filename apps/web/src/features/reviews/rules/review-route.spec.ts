import { expect, it } from 'vitest';
import { reviewRouteSearch } from './review-route';
it('keeps the decision and paired environment in a durable browser destination', () => {
  expect(
    reviewRouteSearch({
      decision: 'layer',
      environment: 'remote',
      revision: '4',
    }),
  ).toEqual({ decision: 'layer', environment: 'remote' });
  expect(reviewRouteSearch({ decision: ['layer'], environment: 7 })).toEqual({
    decision: undefined,
    environment: undefined,
  });
});
