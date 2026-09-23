import type { DiscoveryIssue } from '@porcelain/git/dtos/discovery-issue';

export interface ListableProject {
  id: string;
  commonDirectory: string;
  repositoryIdentity: string;
}

export type WorktreeStatus = 'pending' | 'reviewed' | 'replied';

export interface ResolvedWorktree {
  id: string;
  projectId: string;
  path: string;
  branch: string | null;
  main: boolean;
  available: boolean;
  metadataIdentity: string;
  administrativeDirectory: string;
  commonDirectory: string;
  repositoryIdentity: string;
}

export interface ProjectListing {
  projectId: string;
  worktrees: ResolvedWorktree[];
  issues: DiscoveryIssue[];
  failure?: unknown;
  complete: boolean;
}
