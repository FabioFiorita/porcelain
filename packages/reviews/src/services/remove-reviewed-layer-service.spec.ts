import { describe, expect, it } from 'vitest';
import { InMemoryReviewedLayerStore } from '../../spec/fakes/in-memory-reviewed-layer-store.ts';
import { RemoveReviewedLayerService } from './remove-reviewed-layer-service.ts';

const worktreeId = 'a'.repeat(64);
const other = 'b'.repeat(64);
const reviewedAt = '2026-09-01T00:00:00.000Z';

function mark(layerId: string) {
  return {
    layerId,
    fingerprint: `fingerprint-${layerId}`,
    reviewedAt,
    stale: false,
  };
}

function setup() {
  const store = new InMemoryReviewedLayerStore([
    { worktreeId, ...mark('layer-1') },
    { worktreeId, ...mark('layer-2') },
    { worktreeId: other, ...mark('layer-1') },
  ]);
  return { store, service: new RemoveReviewedLayerService(store) };
}

describe('RemoveReviewedLayerService', () => {
  it('removes the mark and answers the marks that remain', () => {
    const { service } = setup();
    expect(service.execute({ worktreeId, layerId: 'layer-1' })).toEqual({
      worktreeId,
      marks: [mark('layer-2')],
      removed: true,
    });
  });

  it('leaves the same layer marked in another worktree', () => {
    const { store, service } = setup();
    service.execute({ worktreeId, layerId: 'layer-1' });
    expect(store.list({ worktreeId: other })).toEqual([mark('layer-1')]);
  });

  it('reports nothing removed for a layer that was never marked', () => {
    const { store, service } = setup();
    expect(service.execute({ worktreeId, layerId: 'layer-3' }).removed).toBe(
      false,
    );
    expect(store.list({ worktreeId })).toHaveLength(2);
  });

  it('reports nothing removed when the same mark is removed twice', () => {
    const { service } = setup();
    service.execute({ worktreeId, layerId: 'layer-1' });
    expect(service.execute({ worktreeId, layerId: 'layer-1' }).removed).toBe(
      false,
    );
  });
});
