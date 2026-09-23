import { describe, expect, it } from 'vitest';
import { ReviewedMarkConflictError } from '@porcelain/reviews/errors';
import { fingerprint } from '@porcelain/reviews/rules';
import type { Review } from '@porcelain/reviews/models';
import { FixedClock } from '../../spec/fakes/fixed-clock.ts';
import { InMemoryReviewedLayerStore } from '../../spec/fakes/in-memory-reviewed-layer-store.ts';
import { SetReviewedLayerService } from './set-reviewed-layer-service.ts';

const worktreeId = 'a'.repeat(64);
const layerId = 'layer-1';
const stepId = 'step-1';

const review: Review = {
  worktreeId,
  revision: 1,
  publishedAt: '2026-01-01T00:00:00.000Z',
  active: true,
  summaryHtml: '<p>Summary</p>',
  summaryToken: 'token',
  summarySecret: 'secret',
  layers: [
    {
      id: layerId,
      title: 'Readme',
      summary: 'Adds a line',
      lanes: ['Docs'],
      fingerprint: 'published',
      steps: [
        {
          id: stepId,
          lane: 0,
          title: 'New line',
          text: 'A line is added',
          kind: 'changed',
          pointer: { path: 'README.md', startLine: 2, endLine: 2 },
          published: ['added'],
        },
      ],
    },
  ],
};

const located = fingerprint(`${stepId}:added`);
const moved = fingerprint(`${stepId}:changed`);

function setup() {
  const store = new InMemoryReviewedLayerStore();
  return {
    store,
    service: new SetReviewedLayerService(store, new FixedClock()),
  };
}

describe('SetReviewedLayerService', () => {
  it('marks a layer at the fingerprint its steps have in the current files', () => {
    const { service } = setup();
    const result = service.execute({
      worktreeId,
      layerId,
      fingerprint: located,
      review,
      files: new Map([['README.md', 'first\nadded\n']]),
    });
    expect(result.marks).toEqual([
      {
        layerId,
        fingerprint: located,
        reviewedAt: '2026-01-01T00:00:00.000Z',
        stale: false,
      },
    ]);
  });

  it('accepts the fingerprint of a layer whose step text moved away', () => {
    const { service } = setup();
    expect(
      service.execute({
        worktreeId,
        layerId,
        fingerprint: moved,
        review,
        files: new Map([['README.md', 'first\n']]),
      }).marks,
    ).toHaveLength(1);
  });

  it('refuses a fingerprint the layer no longer has', () => {
    const { service, store } = setup();
    expect(() =>
      service.execute({
        worktreeId,
        layerId,
        fingerprint: located,
        review,
        files: new Map([['README.md', 'first\n']]),
      }),
    ).toThrow(ReviewedMarkConflictError);
    expect(store.list(worktreeId)).toEqual([]);
  });

  it('refuses a layer the review does not have, or any layer when nothing is published', () => {
    const { service } = setup();
    const files = new Map([['README.md', 'first\nadded\n']]);
    expect(() =>
      service.execute({
        worktreeId,
        layerId: 'other',
        fingerprint: located,
        review,
        files,
      }),
    ).toThrow(ReviewedMarkConflictError);
    expect(() =>
      service.execute({
        worktreeId,
        layerId,
        fingerprint: located,
        review: undefined,
        files,
      }),
    ).toThrow(ReviewedMarkConflictError);
  });
});
