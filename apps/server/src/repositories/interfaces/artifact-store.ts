import type {
  Artifact,
  ArtifactMetadata,
  ArtifactUpload,
} from '../../models/artifact.ts';

export interface ArtifactStore {
  create(
    worktreeId: string,
    input: ArtifactUpload,
    sizeBytes: number,
  ): ArtifactMetadata;
  list(worktreeId: string): ArtifactMetadata[];
  get(worktreeId: string, artifactId: string): Artifact | undefined;
  delete(worktreeId: string, artifactId: string): boolean;
}
