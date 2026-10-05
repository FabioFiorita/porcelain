import type { Effect } from 'effect';
import type {
  ProjectRepository,
  RepositoryLocation,
} from '../models/project-repository.ts';

export interface ProjectRepositoryReader {
  find(input: RepositoryLocation): Effect.Effect<ProjectRepository | undefined>;
  readOriginUrl(input: RepositoryLocation): Effect.Effect<string | undefined>;
}
