import type { DiscoveryResult } from '../dtos/discovery-result.ts';

export interface WorktreeReader {
  /**
   * `known` is for a caller that already has the repository's common
   * directory — a registered project does. Passing it saves the `rev-parse`
   * that would go and find it, which is the difference between two Git
   * processes per listing and one. Discovering a repository from an arbitrary
   * checkout still needs both.
   */
  listWorktrees(
    signal?: AbortSignal,
    known?: { commonDirectory: string },
  ): Promise<DiscoveryResult>;
}

export type GitFactory = (checkout: string) => WorktreeReader;
