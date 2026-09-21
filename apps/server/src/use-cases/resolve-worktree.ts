import { RepositoryIdentityMismatchError } from '@porcelain/git/errors/repository-identity-mismatch-error';
import type { ResolvedWorktree } from '../models/worktree.ts';
import type { InventoryStore } from '../repositories/interfaces/inventory-store.ts';
import type { WorktreePresenceStore } from '../repositories/interfaces/worktree-presence-store.ts';
import type { WorktreeSource } from '../repositories/interfaces/worktree-source.ts';
import { WorktreeNotFoundError } from './errors/worktree-not-found-error.ts';

/**
 * The one answer to "does this worktree exist?".
 *
 * Reviewed marks, published reviews, comments and Git reads all ask here, so
 * they cannot disagree. Two questions are kept apart on purpose:
 *
 * - **Known** — Git lists it, so review data may be written for it.
 * - **Reachable** — its checkout can be read, so Git may run in it.
 *
 * An unplugged worktree is known but not reachable. Answering "gone" for it
 * would let its comments be collected while the disk is simply out.
 */
export class ResolveWorktree {
  private readonly directory: WorktreeSource;
  private readonly store: InventoryStore;
  private readonly presence: Pick<WorktreePresenceStore, 'record'>;

  constructor(
    directory: WorktreeSource,
    store: InventoryStore,
    presence: Pick<WorktreePresenceStore, 'record'>,
  ) {
    this.directory = directory;
    this.store = store;
    this.presence = presence;
  }

  /** The worktree, or `WorktreeNotFoundError`. */
  async known(
    worktreeId: string,
    signal?: AbortSignal,
  ): Promise<ResolvedWorktree> {
    const resolved = await this.directory.resolve(worktreeId, signal);
    if (!resolved) throw new WorktreeNotFoundError();
    return resolved;
  }

  /** The worktree, refusing one whose checkout cannot be read. */
  async reachable(
    worktreeId: string,
    signal?: AbortSignal,
  ): Promise<ResolvedWorktree> {
    const resolved = await this.known(worktreeId, signal);
    const project = this.store
      .read()
      .projects.find((entry) => entry.id === resolved.projectId);
    // The existing unavailability answer: 422, not 404. A worktree whose disk
    // is out has not stopped existing.
    if (!project?.available || !resolved.available)
      throw new RepositoryIdentityMismatchError();
    return resolved;
  }

  /**
   * The worktree, about to have review data written for it.
   *
   * Presence is recorded first, on purpose. A crash between the two leaves a
   * presence row with no data, which the cleanup collects after thirty
   * observed days; the other order would leave data the cleanup can never see.
   */
  async forWriting(
    worktreeId: string,
    signal?: AbortSignal,
  ): Promise<ResolvedWorktree> {
    const resolved = await this.known(worktreeId, signal);
    this.presence.record(resolved.id, resolved.projectId);
    return resolved;
  }

  /** The worktree, when the caller already knows which project it is in. */
  async inProject(
    projectId: string,
    worktreeId: string,
    signal?: AbortSignal,
  ): Promise<ResolvedWorktree> {
    const resolved = await this.reachable(worktreeId, signal);
    if (resolved.projectId !== projectId) throw new WorktreeNotFoundError();
    return resolved;
  }
}
