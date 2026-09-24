import type {
  DiscoveredProjectRepository,
  RepositoryLocation,
} from '../../src/models/project-repository.ts';
import type { ProjectRepositoryReader } from '../../src/ports/project-repository-reader.ts';

export class ScriptedProjectRepositoryReader implements ProjectRepositoryReader {
  private readonly repositories = new Map<
    string,
    DiscoveredProjectRepository
  >();
  private readonly origins = new Map<string, string>();

  repository(path: string, repository: DiscoveredProjectRepository): void {
    this.repositories.set(path, repository);
  }

  origin(path: string, originUrl: string): void {
    this.origins.set(path, originUrl);
  }

  async inspect(
    input: RepositoryLocation,
  ): Promise<DiscoveredProjectRepository> {
    return (
      this.repositories.get(input.path) ??
      Promise.reject(new Error(`Not a repository: ${input.path}`))
    );
  }

  async find(
    input: RepositoryLocation,
  ): Promise<DiscoveredProjectRepository | undefined> {
    return this.repositories.get(input.path);
  }

  async readOriginUrl(input: RepositoryLocation): Promise<string | undefined> {
    return this.origins.get(input.path);
  }
}
