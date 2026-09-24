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

  execute(
    input: InspectProjectRepositoryInput,
    signal?: AbortSignal,
  ): Promise<InspectProjectRepositoryResult> {
    return this.projectRepositoryReader.inspect({ path: input.path }, signal);
  }
}
