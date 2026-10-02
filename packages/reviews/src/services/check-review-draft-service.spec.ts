import { describe, expect, it } from 'vitest';
import {
  DuplicateLayerIdError,
  ReviewConflictError,
  UnknownProofTargetError,
} from '@porcelain/reviews/errors';
import type {
  LayerDraft,
  Review,
  ReviewDraft,
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

function draft(overrides: Partial<ReviewDraft> = {}): ReviewDraft {
  return {
    expectedRevision: 1,
    summaryHtml: '<p>Summary</p>',
    layers: [layer],
    ...overrides,
  };
}

const service = () =>
  new CheckReviewDraftService(new InMemoryReviewStore([published]));

describe('CheckReviewDraftService', () => {
  it('accepts a sound draft that states the current revision, leaving the published review in place', () => {
    const reviews = new InMemoryReviewStore([published]);
    expect(() =>
      new CheckReviewDraftService(reviews).execute({
        worktreeId,
        draft: draft(),
      }),
    ).not.toThrow();
    expect(reviews.read({ worktreeId })).toEqual(published);
  });

  it('refuses a draft that states another revision', () => {
    expect(() =>
      service().execute({ worktreeId, draft: draft({ expectedRevision: 0 }) }),
    ).toThrow(ReviewConflictError);
  });

  it('refuses a malformed draft before comparing revisions', () => {
    expect(() =>
      service().execute({
        worktreeId,
        draft: draft({ expectedRevision: 0, layers: [layer, layer] }),
      }),
    ).toThrow(DuplicateLayerIdError);
  });

  it('refuses proof on a layer the draft does not have', () => {
    expect(() =>
      service().execute({
        worktreeId,
        draft: draft({
          proof: { checks: [{ name: 'Tests', result: 'pass', layerId: 'x' }] },
        }),
      }),
    ).toThrow(UnknownProofTargetError);
  });
});
