import { describe, expect, it } from 'vitest';
import { FixedClock } from '@porcelain/kernel/fakes';
import { ReviewSummaryNotFoundError } from '@porcelain/reviews/errors';
import type { Review } from '@porcelain/reviews/models';
import { InMemoryReviewStore } from '../../spec/fakes/in-memory-review-store.ts';
import { ScriptedSignatureSource } from '../../spec/fakes/scripted-signature-source.ts';
import { ReadReviewSummaryService } from './read-review-summary-service.ts';

const token = '6f1c2f4e-7c1b-4b61-9d6e-2f0a4f3a9b10';
const expires = '2026-01-01T01:00:00.000Z';
const signature = `secret:${token}\0${expires}`;

const review: Review = {
  worktreeId: 'a'.repeat(64),
  revision: 1,
  publishedAt: '2026-01-01T00:00:00.000Z',
  active: true,
  summaryHtml: '<h1>Summary</h1>',
  summaryToken: token,
  summarySecret: 'secret',
  layers: [],
};

function setup(now = '2026-01-01T00:30:00.000Z') {
  const store = new InMemoryReviewStore();
  store.save(review);
  return new ReadReviewSummaryService(
    store,
    new FixedClock(now),
    new ScriptedSignatureSource(),
  );
}

describe('ReadReviewSummaryService', () => {
  it('serves the summary for a link signed with its secret until the link expires', () => {
    expect(setup().execute({ token, expires, signature })).toEqual({
      html: '<h1>Summary</h1>',
    });
    expect(setup(expires).execute({ token, expires, signature }).html).toBe(
      '<h1>Summary</h1>',
    );
  });

  it('refuses a link after it expired', () => {
    expect(() =>
      setup('2026-01-01T01:00:00.001Z').execute({ token, expires, signature }),
    ).toThrow(ReviewSummaryNotFoundError);
  });

  it('refuses a wrong signature or an expiry changed after signing', () => {
    const service = setup();
    expect(() =>
      service.execute({ token, expires, signature: 'A'.repeat(43) }),
    ).toThrow(ReviewSummaryNotFoundError);
    expect(() =>
      service.execute({
        token,
        expires: '2026-01-02T01:00:00.000Z',
        signature,
      }),
    ).toThrow(ReviewSummaryNotFoundError);
  });

  it('refuses the link of a summary that is no longer published', () => {
    expect(() =>
      setup().execute({
        token: '6f1c2f4e-7c1b-4b61-9d6e-2f0a4f3a9b11',
        expires,
        signature,
      }),
    ).toThrow(ReviewSummaryNotFoundError);
  });
});
