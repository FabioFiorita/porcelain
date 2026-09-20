import type { ArtifactStore } from '../repositories/interfaces/artifact-store.ts';
import { assertArtifactScope } from './assert-artifact-scope.ts';
import type { ResolveWorktree } from './resolve-worktree.ts';

export class ListArtifacts {
  private readonly store: Pick<ArtifactStore, 'list'>;
  private readonly worktrees: ResolveWorktree;
  constructor(store: Pick<ArtifactStore, 'list'>, worktrees: ResolveWorktree) {
    this.store = store;
    this.worktrees = worktrees;
  }
  async execute(worktreeId: string, signal?: AbortSignal) {
    await assertArtifactScope(this.worktrees, worktreeId, signal);
    return this.store.list(worktreeId);
  }
}
