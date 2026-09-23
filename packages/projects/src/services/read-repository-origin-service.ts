import type { ReadRepositoryOriginInput } from '../models/project-operations.ts';
import type { RepositoryOrigin } from '../models/project-repository.ts';
import type { ProjectRepositoryReader } from '../ports/project-repository-reader.ts';

export class ReadRepositoryOriginService {
  private readonly projectRepositoryReader: ProjectRepositoryReader;

  constructor(projectRepositoryReader: ProjectRepositoryReader) {
    this.projectRepositoryReader = projectRepositoryReader;
  }

  async execute(
    input: ReadRepositoryOriginInput,
    signal?: AbortSignal,
  ): Promise<RepositoryOrigin> {
    return {
      originUrl: await this.projectRepositoryReader.readOriginUrl(
        input.path,
        signal,
      ),
    };
  }
}
