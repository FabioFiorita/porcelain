import type { GitActionIntent } from '@porcelain/git/dtos/git-action';
import type { CommitReaderFactory } from '@porcelain/git/interfaces/commit-reader';
import type { GitActionScope } from '../models/git-action.ts';
import type { InventoryStore } from '../repositories/interfaces/inventory-store.ts';
import type { ReviewLayerStore } from '../repositories/interfaces/review-layer-store.ts';
import { resolveHistoryCheckout } from './resolve-history-checkout.ts';
import type { ResolveWorktree } from './resolve-worktree.ts';

/**
 * What a commit finishes: the files it carried leave the live review layers,
 * so a worktree stops asking to be reviewed for work that has been committed.
 *
 * Step 5c removed the per-commit review surface, which is what used to keep a
 * copy of those layers under the commit. Clearing them is a different thing
 * and belongs to the live layers, so it stayed.
 */
export class CompleteCommitReview {
  private readonly inventory: InventoryStore;
  private readonly worktrees: ResolveWorktree;
  private readonly layers: ReviewLayerStore;
  private readonly git: CommitReaderFactory;
  constructor(
    inventory: InventoryStore,
    worktrees: ResolveWorktree,
    layers: ReviewLayerStore,
    git: CommitReaderFactory,
  ) {
    this.inventory = inventory;
    this.worktrees = worktrees;
    this.layers = layers;
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
    // Only the names are needed, so this is the file list rather than the
    // whole commit: one Git process where the old read spent nine.
    const changes = await this.git(
      await resolveHistoryCheckout(
        this.worktrees,
        this.inventory,
        scope.worktreeId,
        signal,
      ),
    ).readCommitFiles({ oid }, signal);
    const committed = new Set(
      changes.files.map((change) => change.newPath ?? change.oldPath),
    );
    const includes = (file: { path: string; scope: string }) =>
      committed.has(file.path) &&
      (intent.paths !== undefined || file.scope === 'staged');
    const completed = source.layers.some((layer) => layer.files.some(includes));
    if (!completed) return;
    const remaining = source.layers
      .map((layer) => ({
        ...layer,
        files: layer.files.filter((file) => !includes(file)),
      }))
      .filter((layer) => layer.files.length);
    signal.throwIfAborted();
    this.layers.replace(scope.worktreeId, source.revision, remaining);
  }
}
