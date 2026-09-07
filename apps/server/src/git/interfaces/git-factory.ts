import type { DiscoveredRepository } from '../dtos/discovered-repository.ts';
import type { DiscoveryIssue } from '../dtos/discovery-issue.ts';

export interface WorktreeReader {
  listWorktrees(
    signal?: AbortSignal,
    reportIssue?: (issue: DiscoveryIssue) => void,
  ): Promise<DiscoveredRepository>;
}

export type GitFactory = (checkout: string) => WorktreeReader;
