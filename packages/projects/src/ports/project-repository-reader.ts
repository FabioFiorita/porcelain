import type {
  ProjectRepository,
  RepositoryLocation,
} from '../models/project-repository.ts';

export interface ProjectRepositoryReader {
  find(
    input: RepositoryLocation,
    signal?: AbortSignal,
  ): Promise<ProjectRepository | undefined>;
  readOriginUrl(
    input: RepositoryLocation,
    signal?: AbortSignal,
  ): Promise<string | undefined>;
}
