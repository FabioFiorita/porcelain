import type {
  DiscoveredProjectRepository,
  RepositoryLocation,
} from '../models/project-repository.ts';

export interface ProjectRepositoryReader {
  inspect(
    input: RepositoryLocation,
    signal?: AbortSignal,
  ): Promise<DiscoveredProjectRepository>;
  find(
    input: RepositoryLocation,
    signal?: AbortSignal,
  ): Promise<DiscoveredProjectRepository | undefined>;
  readOriginUrl(
    input: RepositoryLocation,
    signal?: AbortSignal,
  ): Promise<string | undefined>;
}
