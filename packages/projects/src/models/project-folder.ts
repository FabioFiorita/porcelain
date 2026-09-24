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

export type DiscoveryFolder = { path: string; depth: number };

export type DiscoveryWalk = {
  queue: readonly DiscoveryFolder[];
  next: number;
  visited: ReadonlySet<string>;
  candidates: readonly string[];
  limited: boolean;
};

export type DiscoveryPolicy = {
  maxDepth: number;
  maxFolders: number;
  skipHidden: boolean;
  skippedNames: readonly string[];
};
