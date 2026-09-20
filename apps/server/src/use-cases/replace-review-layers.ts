import type { ReviewLayer } from '../models/review-layers.ts';
import type { ReviewLayerStore } from '../repositories/interfaces/review-layer-store.ts';
import type { ResolveWorktree } from './resolve-worktree.ts';
export class ReplaceReviewLayers {
  private readonly store: ReviewLayerStore;
  private readonly worktrees: ResolveWorktree;
  constructor(store: ReviewLayerStore, worktrees: ResolveWorktree) {
    this.store = store;
    this.worktrees = worktrees;
  }
  async execute(
    worktreeId: string,
    expectedRevision: number,
    layers: ReviewLayer[],
    signal?: AbortSignal,
  ) {
    // A write: the worktree is recorded as present before layers are stored.
    await this.worktrees.forWriting(worktreeId, signal);
    return this.store.replace(worktreeId, expectedRevision, layers);
  }
}
