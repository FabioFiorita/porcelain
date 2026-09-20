import type { ArtifactStore } from '../repositories/interfaces/artifact-store.ts';
import { assertArtifactScope } from './assert-artifact-scope.ts';
import type { ResolveWorktree } from './resolve-worktree.ts';

export class DeleteArtifact {
  private readonly store: Pick<ArtifactStore, 'delete'>;
  private readonly worktrees: ResolveWorktree;
  constructor(
    store: Pick<ArtifactStore, 'delete'>,
    worktrees: ResolveWorktree,
  ) {
    this.store = store;
    this.worktrees = worktrees;
  }
  async execute(worktreeId: string, artifactId: string, signal?: AbortSignal) {
    await assertArtifactScope(this.worktrees, worktreeId, signal);
    return { deleted: this.store.delete(worktreeId, artifactId) };
  }
}
