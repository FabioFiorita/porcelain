import type { InspectProjectRepositoryInput } from '../models/project-operations.ts';
import type { DiscoveredProjectRepository } from '../models/project-repository.ts';
import type { ProjectRepositoryReader } from '../ports/project-repository-reader.ts';

export class InspectProjectRepositoryService {
  private readonly projectRepositoryReader: ProjectRepositoryReader;

  constructor(projectRepositoryReader: ProjectRepositoryReader) {
    this.projectRepositoryReader = projectRepositoryReader;
  }

  execute(
    input: InspectProjectRepositoryInput,
    signal?: AbortSignal,
  ): Promise<DiscoveredProjectRepository> {
    return this.projectRepositoryReader.inspect(input.path, signal);
  }
}
