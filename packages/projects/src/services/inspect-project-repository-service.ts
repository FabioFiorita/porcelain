import { RepositoryUnavailableError } from '../errors/repository-unavailable-error.ts';
import type {
  InspectProjectRepositoryInput,
  InspectProjectRepositoryResult,
} from '../models/inspect-project-repository.ts';
import type { ProjectRepositoryReader } from '../ports/project-repository-reader.ts';

export class InspectProjectRepositoryService {
  private readonly projectRepositoryReader: ProjectRepositoryReader;

  constructor(projectRepositoryReader: ProjectRepositoryReader) {
    this.projectRepositoryReader = projectRepositoryReader;
  }

  async execute(
    input: InspectProjectRepositoryInput,
    signal?: AbortSignal,
  ): Promise<InspectProjectRepositoryResult> {
    const repository = await this.projectRepositoryReader.find(
      { path: input.path },
      signal,
    );
    if (!repository) throw new RepositoryUnavailableError();
    return repository;
  }
}
