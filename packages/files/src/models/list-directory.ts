import type { DirectoryEntry } from './directory-entry.ts';

export type ListDirectoryInput = {
  worktreeId: string;
  path: string;
};

export type ListDirectoryResult = {
  worktreeId: string;
  path: string;
  entries: DirectoryEntry[];
  omitted?: number;
};

export type ListDirectoryOptions = {
  maxEntries: number;
  maxResponseBytes: number;
};
