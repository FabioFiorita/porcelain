export type DiscoveredProjectRepository = {
  commonDirectory: string;
  repositoryIdentity: string;
  worktrees: {
    path: string;
    main: boolean;
    available: boolean;
  }[];
};

export interface ProjectRepositoryReader {
  inspect(
    checkout: string,
    signal?: AbortSignal,
  ): Promise<{
    repository: DiscoveredProjectRepository;
    issues: { path: string; error: unknown }[];
  }>;
  readOriginUrl(
    checkout: string,
    signal?: AbortSignal,
  ): Promise<string | undefined>;
  isUnavailable(error: unknown): boolean;
}
