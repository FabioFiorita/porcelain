import type { ProjectLocation } from './project-folder.ts';

export type DiscoverProjectsResult = {
  repositories: ProjectLocation[];
  limited: boolean;
};

export type DiscoverProjectsOptions = {
  home: string;
  maxRepositories: number;
  maxFolders: number;
  maxDepth: number;
  maxEntries: number;
  skippedNames: readonly string[];
};
