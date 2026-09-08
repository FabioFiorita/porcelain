export type ArtifactMetadata = {
  id: string;
  worktreeId: string;
  name: string;
  sizeBytes: number;
  createdAt: string;
};
export type Artifact = ArtifactMetadata & { content: string };
export type ArtifactUpload = { name: string; content: string };
export const artifactLimits = {
  contentBytes: 1024 * 1024,
  totalBytes: 16 * 1024 * 1024,
  count: 256,
};
