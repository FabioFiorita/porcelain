import { Effect } from 'effect';
import type {
  ProjectRepository,
  RepositoryLocation,
} from '../../src/models/project-repository.ts';
import type { ProjectRepositoryReader } from '../../src/ports/project-repository-reader.ts';

export class ScriptedProjectRepositoryReader implements ProjectRepositoryReader {
  private readonly repositories: ReadonlyMap<string, ProjectRepository>;
  private readonly origins: ReadonlyMap<string, string>;

  constructor(
    stored: {
      repositories?: Record<string, ProjectRepository> | undefined;
      origins?: Record<string, string> | undefined;
    } = {},
  ) {
    this.repositories = new Map(Object.entries(stored.repositories ?? {}));
    this.origins = new Map(Object.entries(stored.origins ?? {}));
  }

  find(
    input: RepositoryLocation,
  ): Effect.Effect<ProjectRepository | undefined> {
    return Effect.sync(() => {
      return this.repositories.get(input.path);
    });
  }

  readOriginUrl(input: RepositoryLocation): Effect.Effect<string | undefined> {
    return Effect.sync(() => {
      return this.origins.get(input.path);
    });
  }
}
