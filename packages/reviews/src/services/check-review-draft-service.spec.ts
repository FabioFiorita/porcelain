import { ValidateReviewDraftService } from '@porcelain/reviews/services';
import { Effect } from 'effect';
import { describe, expect, it } from 'vitest';
import { ReviewConflictError } from '@porcelain/reviews/errors';
import type {
  LayerDraft,
  Review,
  ReviewDraft,
  ValidatedReviewDraft,
} from '@porcelain/reviews/models';
import { InMemoryReviewStore } from '../../spec/fakes/in-memory-review-store.ts';
import { CheckReviewDraftService } from './check-review-draft-service.ts';

const worktreeId = 'a'.repeat(64);
const layer: LayerDraft = {
  id: 'layer-1',
  title: 'Readme',
  summary: 'Adds a line',
  lanes: ['Docs'],
  steps: [
    {
      id: 'step-1',
      lane: 0,
      title: 'New line',
      text: 'A line is added',
      kind: 'changed',
      pointer: { path: 'README.md', startLine: 2, endLine: 3 },
    },
  ],
};
const published: Review = {
  worktreeId,
  revision: 1,
  publishedAt: '2026-01-01T00:00:00.000Z',
  active: true,
  summaryHtml: '<p>Summary</p>',
  summaryToken: 'token',
  summarySecret: 'secret',
  layers: [],
};

function draft(overrides: Partial<ReviewDraft> = {}): ValidatedReviewDraft {
  return Effect.runSync(
    new ValidateReviewDraftService().execute({
      expectedRevision: 1,
      summaryHtml: '<p>Summary</p>',
      layers: [layer],
      ...overrides,
    }),
  );
}

const service = () =>
  new CheckReviewDraftService(new InMemoryReviewStore([published]));

describe('CheckReviewDraftService', () => {
  it('accepts a sound draft that states the current revision', () => {
    expect(() =>
      Effect.runSync(service().execute({ worktreeId, draft: draft() })),
    ).not.toThrow();
  });

  it('refuses a draft that states another revision', () => {
    expect(() =>
      Effect.runSync(
        service().execute({
          worktreeId,
          draft: draft({ expectedRevision: 0 }),
        }),
      ),
    ).toThrow(ReviewConflictError);
  });
});
