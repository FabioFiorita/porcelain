import type { CommitReaderFactory } from '@porcelain/git/interfaces/commit-reader';
import type {
  CommitReviewLayerRequest,
  CommitReviewLayers,
} from '../models/commit-review-layers.ts';
import type { ReviewLayer } from '../models/review-layers.ts';
import type { CommitReviewLayerStore } from '../repositories/interfaces/commit-review-layer-store.ts';
import type { InventoryStore } from '../repositories/interfaces/inventory-store.ts';
import type { ReviewLayerStore } from '../repositories/interfaces/review-layer-store.ts';
import { CommitReviewLayerConflictError } from './errors/commit-review-layer-conflict-error.ts';
import { InvalidCommitReviewLayersError } from './errors/invalid-commit-review-layers-error.ts';
import { ProjectNotFoundError } from './errors/project-not-found-error.ts';
import { StaleReviewLayerSourceError } from './errors/stale-review-layer-source-error.ts';
import { WorktreeNotFoundError } from './errors/worktree-not-found-error.ts';
import { resolveHistoryCheckout } from './resolve-history-checkout.ts';

export class AssociateCommitReviewLayers {
  private readonly inventory: InventoryStore;
  private readonly layers: ReviewLayerStore;
  private readonly snapshots: CommitReviewLayerStore;
  private readonly git: CommitReaderFactory;
  constructor(
    inventory: InventoryStore,
    layers: ReviewLayerStore,
    snapshots: CommitReviewLayerStore,
    git: CommitReaderFactory,
  ) {
    this.inventory = inventory;
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
    const project = this.inventory
      .read()
      .projects.find((entry) => entry.id === projectId);
    if (!project) throw new ProjectNotFoundError();
    const existing = this.snapshots.read(projectId, commitOid);
    if (existing) return retryAssociation(existing, request);
    if (
      !project.worktrees.some(
        (worktree) => worktree.id === request.sourceWorktreeId,
      )
    )
      throw new WorktreeNotFoundError();
    const source = this.layers.read(request.sourceWorktreeId);
    if (source.revision !== request.sourceRevision)
      throw new StaleReviewLayerSourceError();
    const layers = selectLayers(source.layers, request.references);
    const changes = await this.git(
      resolveHistoryCheckout(this.inventory, request.sourceWorktreeId),
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

function referenceKey(reference: ReviewLayer['files'][number]) {
  return JSON.stringify([reference.path, reference.scope]);
}
function selectLayers(layers: ReviewLayer[], references: ReviewLayer['files']) {
  const selected = new Set(references.map(referenceKey));
  if (
    references.length === 0 ||
    references.length > 500 ||
    new Set(references.map((reference) => reference.path)).size !==
      references.length
  )
    throw new InvalidCommitReviewLayersError();
  const result = layers
    .map((layer) => ({
      ...layer,
      files: layer.files.filter((file) => selected.has(referenceKey(file))),
    }))
    .filter((layer) => layer.files.length > 0);
  if (
    result.reduce((count, layer) => count + layer.files.length, 0) !==
    selected.size
  )
    throw new InvalidCommitReviewLayersError();
  return result;
}
function retryAssociation(
  existing: CommitReviewLayers,
  request: CommitReviewLayerRequest,
) {
  const saved = existing.layers
    .flatMap((layer) => layer.files)
    .map(referenceKey)
    .sort();
  const requested = request.references.map(referenceKey).sort();
  if (
    existing.sourceWorktreeId !== request.sourceWorktreeId ||
    existing.sourceRevision !== request.sourceRevision ||
    existing.parentNumber !== request.parentNumber ||
    JSON.stringify(saved) !== JSON.stringify(requested)
  )
    throw new CommitReviewLayerConflictError();
  return existing;
}
