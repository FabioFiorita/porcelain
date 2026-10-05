import { Effect } from 'effect';
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

  execute(
    input: InspectProjectRepositoryInput,
  ): Effect.Effect<InspectProjectRepositoryResult, RepositoryUnavailableError> {
    return Effect.gen({ self: this }, function* () {
      const repository = yield* this.projectRepositoryReader.find({
        path: input.path,
      });
      if (!repository)
        return yield* Effect.fail(new RepositoryUnavailableError());
      return repository;
    });
  }
}
