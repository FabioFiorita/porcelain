export type ProjectLocation = { name: string; path: string };

export type FolderEntry = ProjectLocation & { symbolicLink: boolean };

export type ProjectFolderContents = {
  path: string;
  parent: string | undefined;
  directories: FolderEntry[];
  gitMarker: boolean;
  truncated: boolean;
};

export type ReadProjectFolderInput = { path: string; maxEntries: number };

export type ProjectFolderRead =
  | { kind: 'read'; contents: ProjectFolderContents }
  | { kind: 'missing' }
  | { kind: 'unreadable' }
  | { kind: 'unsupported-name' };

export type FolderSearch = {
  roots: string[];
  maxDepth: number;
  maxFolders: number;
  maxEntries: number;
  skipHidden: boolean;
  skippedNames: readonly string[];
};

export type FolderSearchResult = {
  candidates: string[];
  limited: boolean;
};
