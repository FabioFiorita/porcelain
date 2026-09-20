import type { ArtifactStore } from '../repositories/interfaces/artifact-store.ts';
import { assertArtifactScope } from './assert-artifact-scope.ts';
import { ArtifactNotFoundError } from './errors/artifact-not-found-error.ts';
import type { ResolveWorktree } from './resolve-worktree.ts';

export class GetArtifact {
  private readonly store: Pick<ArtifactStore, 'get'>;
  private readonly worktrees: ResolveWorktree;
  constructor(store: Pick<ArtifactStore, 'get'>, worktrees: ResolveWorktree) {
    this.store = store;
    this.worktrees = worktrees;
  }
  async execute(worktreeId: string, artifactId: string, signal?: AbortSignal) {
    await assertArtifactScope(this.worktrees, worktreeId, signal);
    const artifact = this.store.get(worktreeId, artifactId);
    if (!artifact) throw new ArtifactNotFoundError();
    return artifact;
  }
}
