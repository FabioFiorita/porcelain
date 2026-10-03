import type { DiscoveryResult } from '../dtos/discovery-result.ts';

export interface WorktreeReader {
  listWorktrees(
    signal?: AbortSignal,
    known?: { commonDirectory: string },
  ): Promise<DiscoveryResult>;
  readOriginUrl(signal?: AbortSignal): Promise<string | null>;
}

export interface GitFactory {
  (checkout: string): WorktreeReader;
}
