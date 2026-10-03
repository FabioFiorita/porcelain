import type {
  ProjectFolderRead,
  ReadProjectFolderInput,
} from '../models/project-folder.ts';

export interface ProjectFolderReader {
  read(
    input: ReadProjectFolderInput,
    signal?: AbortSignal,
  ): Promise<ProjectFolderRead>;
}
