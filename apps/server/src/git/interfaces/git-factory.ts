import type { DiscoveryResult } from '../dtos/discovery-result.ts';

export interface WorktreeReader {
  listWorktrees(signal?: AbortSignal): Promise<DiscoveryResult>;
}

export type GitFactory = (checkout: string) => WorktreeReader;
