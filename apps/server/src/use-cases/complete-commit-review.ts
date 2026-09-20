import type { GitActionIntent } from '@porcelain/git/dtos/git-action';
import type { CommitReaderFactory } from '@porcelain/git/interfaces/commit-reader';
import type { GitActionScope } from '../models/git-action.ts';
import type { CommitReviewLayerStore } from '../repositories/interfaces/commit-review-layer-store.ts';
import type { InventoryStore } from '../repositories/interfaces/inventory-store.ts';
import type { ReviewLayerStore } from '../repositories/interfaces/review-layer-store.ts';
import { resolveHistoryCheckout } from './resolve-history-checkout.ts';
import type { ResolveWorktree } from './resolve-worktree.ts';

export class CompleteCommitReview {
  private readonly inventory: InventoryStore;
  private readonly worktrees: ResolveWorktree;
  private readonly layers: ReviewLayerStore;
  private readonly snapshots: CommitReviewLayerStore;
  private readonly git: CommitReaderFactory;
  constructor(
    inventory: InventoryStore,
    worktrees: ResolveWorktree,
    layers: ReviewLayerStore,
    snapshots: CommitReviewLayerStore,
    git: CommitReaderFactory,
  ) {
    this.inventory = inventory;
    this.worktrees = worktrees;
    this.layers = layers;
    this.snapshots = snapshots;
    this.git = git;
  }
  async execute(
    scope: GitActionScope,
    oid: string,
    intent: Extract<GitActionIntent, { action: 'commit' }>,
    signal: AbortSignal,
  ) {
    const source = this.layers.read(scope.worktreeId);
    if (!source.layers.length) return;
    const changes = await this.git(
      await resolveHistoryCheckout(
        this.worktrees,
        this.inventory,
        scope.worktreeId,
        signal,
      ),
    ).inspectCommitChanges({ oid }, signal);
    const committed = new Set(
      changes.changes.map((change) => change.newPath ?? change.oldPath),
    );
    const includes = (file: { path: string; scope: string }) =>
      committed.has(file.path) &&
      (intent.paths !== undefined || file.scope === 'staged');
    const completed = source.layers
      .map((layer) => ({ ...layer, files: layer.files.filter(includes) }))
      .filter((layer) => layer.files.length);
    if (!completed.length) return;
    const remaining = source.layers
      .map((layer) => ({
        ...layer,
        files: layer.files.filter((file) => !includes(file)),
      }))
      .filter((layer) => layer.files.length);
    signal.throwIfAborted();
    this.snapshots.complete(
      {
        projectId: scope.projectId,
        commitOid: oid,
        sourceWorktreeId: scope.worktreeId,
        sourceRevision: source.revision,
        parentNumber: 1,
        layers: completed,
      },
      remaining,
    );
  }
}
