import { type Effect, Context } from 'effect';
import {
  type ProjectRepository,
  type RepositoryLocation,
} from '../models/project-repository.ts';

export interface ProjectRepositoryReader {
  find(input: RepositoryLocation): Effect.Effect<ProjectRepository | undefined>;
  readOriginUrl(input: RepositoryLocation): Effect.Effect<string | undefined>;
}

export const ProjectRepositoryReader = Context.Service<
  '@porcelain/projects/ProjectRepositoryReader',
  ProjectRepositoryReader
>('@porcelain/projects/ProjectRepositoryReader');
