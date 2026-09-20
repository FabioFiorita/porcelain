import { type ArtifactUpload, artifactLimits } from '../models/artifact.ts';
import type { ArtifactStore } from '../repositories/interfaces/artifact-store.ts';
import { InvalidArtifactError } from './errors/invalid-artifact-error.ts';
import type { ResolveWorktree } from './resolve-worktree.ts';

export class UploadArtifact {
  private readonly store: Pick<ArtifactStore, 'create'>;
  private readonly worktrees: ResolveWorktree;
  constructor(
    store: Pick<ArtifactStore, 'create'>,
    worktrees: ResolveWorktree,
  ) {
    this.store = store;
    this.worktrees = worktrees;
  }
  async execute(
    worktreeId: string,
    input: ArtifactUpload,
    signal?: AbortSignal,
  ) {
    await this.worktrees.forWriting(worktreeId, signal);
    if (
      !input.content.isWellFormed() ||
      !input.name.isWellFormed() ||
      input.name.length < 1 ||
      input.name.length > 256
    )
      throw new InvalidArtifactError();
    const sizeBytes = new TextEncoder().encode(input.content).byteLength;
    if (sizeBytes < 1 || sizeBytes > artifactLimits.contentBytes)
      throw new InvalidArtifactError();
    return this.store.create(worktreeId, input, sizeBytes);
  }
}
