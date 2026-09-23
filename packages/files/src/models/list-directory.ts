import type { DirectoryEntry } from './directory-listing.ts';

export interface ListDirectoryInput {
  worktreeId: string;
  path: string;
}

export interface ListDirectoryResult {
  worktreeId: string;
  path: string;
  entries: DirectoryEntry[];
}
