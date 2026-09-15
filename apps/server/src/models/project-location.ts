export type ProjectLocation = { name: string; path: string };

export type ProjectFolder = {
  path: string;
  parent: string | null;
  directories: ProjectLocation[];
  repository: boolean;
  truncated: boolean;
};

export type ProjectDiscovery = {
  repositories: ProjectLocation[];
  limited: boolean;
};
