import type { DiscoveredRepository } from '../dtos/discovered-repository.ts';

export interface WorktreeReader {
  listWorktrees(): Promise<DiscoveredRepository>;
}

export type GitFactory = (checkout: string) => WorktreeReader;
