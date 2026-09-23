import type { DiscoveredProjectRepository } from '../models/project-repository.ts';

export interface ProjectRepositoryReader {
  inspect(
    checkout: string,
    signal?: AbortSignal,
  ): Promise<DiscoveredProjectRepository>;
  find(
    checkout: string,
    signal?: AbortSignal,
  ): Promise<DiscoveredProjectRepository | undefined>;
  readOriginUrl(
    checkout: string,
    signal?: AbortSignal,
  ): Promise<string | undefined>;
}
