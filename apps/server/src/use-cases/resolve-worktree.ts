import { RepositoryIdentityMismatchError } from '@porcelain/git/errors/repository-identity-mismatch-error';
import type { ResolvedWorktree } from '../models/worktree.ts';
import type { InventoryStore } from '../repositories/interfaces/inventory-store.ts';
import type { WorktreePresenceStore } from '../repositories/interfaces/worktree-presence-store.ts';
import type { WorktreeSource } from '../repositories/interfaces/worktree-source.ts';
import { WorktreeNotFoundError } from './errors/worktree-not-found-error.ts';

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

  async known(
    worktreeId: string,
    signal?: AbortSignal,
  ): Promise<ResolvedWorktree> {
    const resolved = await this.directory.resolve(worktreeId, signal);
    if (!resolved) throw new WorktreeNotFoundError();
    return resolved;
  }

  async reachable(
    worktreeId: string,
    signal?: AbortSignal,
  ): Promise<ResolvedWorktree> {
    const resolved = await this.known(worktreeId, signal);
    const project = this.store
      .read()
      .projects.find((entry) => entry.id === resolved.projectId);
    if (!project?.available || !resolved.available)
      throw new RepositoryIdentityMismatchError();
    return resolved;
  }

  async forWriting(
    worktreeId: string,
    signal?: AbortSignal,
  ): Promise<ResolvedWorktree> {
    const resolved = await this.known(worktreeId, signal);
    this.presence.record(resolved.id, resolved.projectId);
    return resolved;
  }

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
