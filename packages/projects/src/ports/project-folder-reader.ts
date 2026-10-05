import { type Effect, Context } from 'effect';
import {
  type ProjectFolderRead,
  type ReadProjectFolderInput,
} from '../models/project-folder.ts';

export interface ProjectFolderReader {
  read(input: ReadProjectFolderInput): Effect.Effect<ProjectFolderRead>;
}

export const ProjectFolderReader = Context.Service<
  '@porcelain/projects/ProjectFolderReader',
  ProjectFolderReader
>('@porcelain/projects/ProjectFolderReader');
