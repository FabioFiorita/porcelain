import { RepositoryIdentityMismatchError } from '@porcelain/git/discovery';
import { WorktreeNotFoundError } from '@porcelain/projects/errors';
import type { ResolvedWorktree } from '@porcelain/projects/models';
import type { InventoryStore } from '@porcelain/projects/ports';

type WorktreeLookup = {
  resolve(
    worktreeId: string,
    signal?: AbortSignal,
  ): Promise<ResolvedWorktree | null>;
};

type WorktreePresence = {
  record(worktreeId: string, projectId: string): void;
};

export class ResolveWorktree {
  private readonly directory: WorktreeLookup;
  private readonly store: Pick<InventoryStore, 'read'>;
  private readonly presence: WorktreePresence;

  constructor(
    directory: WorktreeLookup,
    store: Pick<InventoryStore, 'read'>,
    presence: WorktreePresence,
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
