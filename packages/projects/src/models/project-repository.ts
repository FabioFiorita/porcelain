export type DiscoveredProjectRepository = {
  commonDirectory: string;
  repositoryIdentity: string;
  worktrees: {
    path: string;
    main: boolean;
    available: boolean;
  }[];
};

export type RepositoryLocation = { path: string };
