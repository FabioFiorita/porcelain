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

  async find(
    input: RepositoryLocation,
  ): Promise<ProjectRepository | undefined> {
    return this.repositories.get(input.path);
  }

  async readOriginUrl(input: RepositoryLocation): Promise<string | undefined> {
    return this.origins.get(input.path);
  }
}
