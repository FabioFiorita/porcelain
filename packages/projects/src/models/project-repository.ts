export type ProjectRepository = {
  commonDirectory: string;
  repositoryIdentity: string;
  worktrees: {
    path: string;
    main: boolean;
    available: boolean;
  }[];
};

export type RepositoryLocation = { path: string };
