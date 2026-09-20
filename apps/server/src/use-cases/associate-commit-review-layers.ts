import type { CommitReaderFactory } from '@porcelain/git/interfaces/commit-reader';
import type {
  CommitReviewLayerRequest,
  CommitReviewLayers,
} from '../models/commit-review-layers.ts';
import type { CommitReviewLayerStore } from '../repositories/interfaces/commit-review-layer-store.ts';
import type { InventoryStore } from '../repositories/interfaces/inventory-store.ts';
import type { ReviewLayerStore } from '../repositories/interfaces/review-layer-store.ts';
import { InvalidCommitReviewLayersError } from './errors/invalid-commit-review-layers-error.ts';
import { ProjectNotFoundError } from './errors/project-not-found-error.ts';
import { StaleReviewLayerSourceError } from './errors/stale-review-layer-source-error.ts';
import {
  retryAssociation,
  selectLayers,
} from './helpers/commit-review-layer-association.ts';
import { resolveHistoryCheckout } from './resolve-history-checkout.ts';
import type { ResolveWorktree } from './resolve-worktree.ts';

export class AssociateCommitReviewLayers {
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
    projectId: string,
    commitOid: string,
    request: CommitReviewLayerRequest,
    signal?: AbortSignal,
  ): Promise<CommitReviewLayers> {
    signal?.throwIfAborted();
    // The project comes first: associating under a project that is gone is a
    // different answer from naming a worktree that is not in it.
    if (!this.inventory.read().projects.some((entry) => entry.id === projectId))
      throw new ProjectNotFoundError();
    // An archived snapshot is immutable, so re-associating the same commit is
    // idempotent and never re-reads the live layers.
    const existing = this.snapshots.read(projectId, commitOid);
    if (existing) return retryAssociation(existing, request);
    // One answer: the source worktree must be in this project.
    await this.worktrees.inProject(projectId, request.sourceWorktreeId, signal);
    const source = this.layers.read(request.sourceWorktreeId);
    if (source.revision !== request.sourceRevision)
      throw new StaleReviewLayerSourceError();
    const layers = selectLayers(source.layers, request.references);
    const changes = await this.git(
      await resolveHistoryCheckout(
        this.worktrees,
        this.inventory,
        request.sourceWorktreeId,
        signal,
      ),
    ).inspectCommitChanges(
      {
        oid: commitOid,
        ...(request.parentNumber === 1 ? {} : { parent: request.parentNumber }),
      },
      signal,
    );
    signal?.throwIfAborted();
    // A rename is ordered by its destination; a deletion by its old path.
    const committed = new Set(
      changes.changes.map((change) => change.newPath ?? change.oldPath),
    );
    if (request.references.some((reference) => !committed.has(reference.path)))
      throw new InvalidCommitReviewLayersError();
    return this.snapshots.create({
      projectId,
      commitOid,
      sourceWorktreeId: request.sourceWorktreeId,
      sourceRevision: request.sourceRevision,
      parentNumber: request.parentNumber,
      layers,
    });
  }
}
