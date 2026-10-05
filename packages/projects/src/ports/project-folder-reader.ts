import type { Effect } from 'effect';
import type {
  ProjectFolderRead,
  ReadProjectFolderInput,
} from '../models/project-folder.ts';

export interface ProjectFolderReader {
  read(input: ReadProjectFolderInput): Effect.Effect<ProjectFolderRead>;
}
