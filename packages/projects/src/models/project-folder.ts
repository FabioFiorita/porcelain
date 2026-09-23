export type ProjectLocation = { name: string; path: string };

export type FolderEntry = ProjectLocation & { symbolicLink: boolean };

export type ProjectFolderContents = {
  path: string;
  parent: string | undefined;
  directories: FolderEntry[];
  gitMarker: boolean;
  truncated: boolean;
};

export type ProjectFolderRead =
  | { outcome: 'read'; contents: ProjectFolderContents }
  | { outcome: 'missing' }
  | { outcome: 'unreadable' }
  | { outcome: 'unsupported-name' };

export type ProjectFolder = {
  path: string;
  parent: string | undefined;
  directories: ProjectLocation[];
  repository: boolean;
  truncated: boolean;
};

export type FolderSearch = {
  roots: string[];
  maxDepth: number;
  maxFolders: number;
  skipHidden: boolean;
  skippedNames: readonly string[];
};

export type FolderSearchResult = {
  candidates: string[];
  limited: boolean;
};

export type ProjectDiscovery = {
  repositories: ProjectLocation[];
  limited: boolean;
};
