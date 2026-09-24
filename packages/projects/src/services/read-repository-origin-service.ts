import type {
  ReadRepositoryOriginInput,
  ReadRepositoryOriginResult,
} from '../models/read-repository-origin.ts';
import type { ProjectRepositoryReader } from '../ports/project-repository-reader.ts';

export class ReadRepositoryOriginService {
  private readonly projectRepositoryReader: ProjectRepositoryReader;

  constructor(projectRepositoryReader: ProjectRepositoryReader) {
    this.projectRepositoryReader = projectRepositoryReader;
  }

  async execute(
    input: ReadRepositoryOriginInput,
    signal?: AbortSignal,
  ): Promise<ReadRepositoryOriginResult> {
    return {
      originUrl: await this.projectRepositoryReader.readOriginUrl(
        { path: input.path },
        signal,
      ),
    };
  }
}
