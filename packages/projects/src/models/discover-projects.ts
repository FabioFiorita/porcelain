import type { ProjectLocation } from './project-folder.ts';
import type { Inventory } from './project.ts';

export type DiscoverProjectsInput = Inventory;

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
