import type {
  ArtifactContentResponse,
  ArtifactMetadataResponse,
} from '@porcelain/contracts/artifacts';
import type { Artifact, ArtifactMetadata } from '../../models/artifact.ts';

export function toArtifactMetadata(
  artifact: ArtifactMetadata,
): ArtifactMetadataResponse {
  return {
    id: artifact.id,
    worktreeId: artifact.worktreeId,
    name: artifact.name,
    sizeBytes: artifact.sizeBytes,
    createdAt: artifact.createdAt,
  };
}
export function toArtifactContent(artifact: Artifact): ArtifactContentResponse {
  return { ...toArtifactMetadata(artifact), content: artifact.content };
}
