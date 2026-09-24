import type { ProjectLocation } from './project-folder.ts';

export type BrowseProjectFoldersInput = { path?: string | undefined };

export type BrowseProjectFoldersResult = {
  path: string;
  parent: string | undefined;
  directories: ProjectLocation[];
  repository: boolean;
  truncated: boolean;
};

export type BrowseProjectFoldersOptions = { home: string; maxEntries: number };
