import type { DiscoveredProjectRepository } from '@porcelain/projects/models';
import type { ProjectRepositoryReader } from '@porcelain/projects/ports';

export class ScriptedProjectRepositoryReader implements ProjectRepositoryReader {
  private readonly repositories = new Map<
    string,
    DiscoveredProjectRepository
  >();
  private readonly origins = new Map<string, string>();

  repository(checkout: string, repository: DiscoveredProjectRepository): void {
    this.repositories.set(checkout, repository);
  }

  origin(checkout: string, originUrl: string): void {
    this.origins.set(checkout, originUrl);
  }

  async inspect(checkout: string): Promise<DiscoveredProjectRepository> {
    const repository = this.repositories.get(checkout);
    if (!repository) throw new Error(`Not a repository: ${checkout}`);
    return repository;
  }

  async find(
    checkout: string,
  ): Promise<DiscoveredProjectRepository | undefined> {
    return this.repositories.get(checkout);
  }

  async readOriginUrl(checkout: string): Promise<string | undefined> {
    return this.origins.get(checkout);
  }
}
