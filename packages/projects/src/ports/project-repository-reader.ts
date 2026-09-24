import type {
  DiscoveredProjectRepository,
  RepositoryLocation,
} from '../models/project-repository.ts';

export interface ProjectRepositoryReader {
  find(
    input: RepositoryLocation,
    signal?: AbortSignal,
  ): Promise<DiscoveredProjectRepository | undefined>;
  readOriginUrl(
    input: RepositoryLocation,
    signal?: AbortSignal,
  ): Promise<string | undefined>;
}
