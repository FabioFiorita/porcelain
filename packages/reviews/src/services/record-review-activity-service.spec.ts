import { Effect } from 'effect';
import { expect, it } from 'vitest';
import { reviewFixture } from '../../spec/fixtures/review.ts';
import { RecordReviewActivityService } from './record-review-activity-service.ts';

it('reports branch-tip transitions without mutating immutable revision data', () => {
  const service = Effect.runSync(
    RecordReviewActivityService.pipe(
      Effect.provide(RecordReviewActivityService.layer),
    ),
  );
  const review = reviewFixture();
  const evidence = {
    headOid: review.headOid,
    changes: [],
    texts: new Map<string, string>(),
    missing: new Set<string>(),
    diffs: [],
  };
  expect(Effect.runSync(service.execute({ review, evidence }))).toEqual({
    changed: false,
  });
  const advanced = { ...evidence, headOid: 'c'.repeat(40) };
  expect(
    Effect.runSync(service.execute({ review, evidence: advanced })),
  ).toEqual({ changed: true });
  expect(
    Effect.runSync(service.execute({ review, evidence: advanced })),
  ).toEqual({ changed: false });
  expect(Effect.runSync(service.execute({ review, evidence }))).toEqual({
    changed: true,
  });
  expect(review.headOid).toBe('a'.repeat(40));
});
