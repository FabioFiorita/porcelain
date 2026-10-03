import { describe, expect, it } from 'vitest';
import { ReviewLayerNotFoundError } from '@porcelain/reviews/errors';
import type { Review, ReviewStep } from '@porcelain/reviews/models';
import { InMemoryReviewStore } from '../../spec/fakes/in-memory-review-store.ts';
import { ReadReviewLayerService } from './read-review-layer-service.ts';

const worktreeId = 'a'.repeat(64);

function step(id: string, path: string): ReviewStep {
  return {
    id,
    lane: 0,
    title: 'Step',
    text: 'Explains',
    kind: 'changed',
    pointer: { path, startLine: 1, endLine: 1 },
    published: ['line'],
  };
}

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
      id: 'layer-1',
      title: 'Readme',
      summary: 'Docs',
      lanes: ['Docs'],
      fingerprint: 'published',
      steps: [
        step('step-1', 'README.md'),
        step('step-2', 'docs/guide.md'),
        step('step-3', 'README.md'),
      ],
    },
  ],
};

describe('ReadReviewLayerService', () => {
  it('reads a layer of the published review with the files its steps point at', () => {
    const store = new InMemoryReviewStore();
    store.save(review);
    const read = new ReadReviewLayerService(store).execute({
      worktreeId,
      layerId: 'layer-1',
    });
    expect(read.layer.id).toBe('layer-1');
    expect(read.paths).toEqual(['README.md', 'docs/guide.md']);
  });

  it('does not find a layer the review does not have, nor any layer before a review is published', () => {
    const store = new InMemoryReviewStore();
    const service = new ReadReviewLayerService(store);
    expect(() => service.execute({ worktreeId, layerId: 'layer-1' })).toThrow(
      ReviewLayerNotFoundError,
    );
    store.save(review);
    expect(() => service.execute({ worktreeId, layerId: 'layer-9' })).toThrow(
      ReviewLayerNotFoundError,
    );
  });
});
