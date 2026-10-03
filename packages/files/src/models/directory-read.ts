import type { DirectoryEntry } from './directory-entry.ts';
import type { ListFailure } from './file-failure.ts';

export type DirectoryReadInput = {
  worktreeId: string;
  path: string;
  limit: number;
};

export type DirectoryRead =
  | { kind: 'listed'; entries: DirectoryEntry[]; truncated: boolean }
  | { kind: 'failed'; failure: ListFailure };
