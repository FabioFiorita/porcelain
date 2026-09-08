import type { DiscoveryIssue } from './git/dtos/discovery-issue.ts';
import type {
  Artifact,
  ArtifactMetadata,
  ArtifactUpload,
} from './models/artifact.ts';
import type { Inventory } from './models/inventory.ts';
import type { Project } from './models/project.ts';

export interface Application {
  inventory(): Inventory;
  uploadArtifact(
    worktreeId: string,
    input: ArtifactUpload,
    signal?: AbortSignal,
  ): Promise<ArtifactMetadata>;
  listArtifacts(
    worktreeId: string,
    signal?: AbortSignal,
  ): Promise<ArtifactMetadata[]>;
  getArtifact(
    worktreeId: string,
    artifactId: string,
    signal?: AbortSignal,
  ): Promise<Artifact>;
  deleteArtifact(
    worktreeId: string,
    artifactId: string,
    signal?: AbortSignal,
  ): Promise<{ deleted: boolean }>;
  register(
    checkout: string,
    signal?: AbortSignal,
  ): Promise<{ project: Project; issues: DiscoveryIssue[] }>;
  refresh(
    signal?: AbortSignal,
  ): Promise<{ inventory: Inventory; issues: DiscoveryIssue[] }>;
  close(): Promise<void>;
}
