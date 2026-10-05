import { Effect } from 'effect';
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

  execute(
    input: ReadRepositoryOriginInput,
  ): Effect.Effect<ReadRepositoryOriginResult, never> {
    return Effect.gen({ self: this }, function* () {
      return {
        originUrl: yield* this.projectRepositoryReader.readOriginUrl({
          path: input.path,
        }),
      };
    });
  }
}
