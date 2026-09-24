import type { DiscoveryResult } from '../dtos/discovery-result.ts';

export type WorktreeReader = {
  listWorktrees(
    signal?: AbortSignal,
    known?: { commonDirectory: string },
  ): Promise<DiscoveryResult>;
  readOriginUrl(signal?: AbortSignal): Promise<string | null>;
};

export type GitFactory = (checkout: string) => WorktreeReader;
