import type {
  FolderSearch,
  FolderSearchResult,
  ProjectFolderRead,
  ReadProjectFolderInput,
} from '../models/project-folder.ts';

export interface ProjectFolderReader {
  read(
    input: ReadProjectFolderInput,
    signal?: AbortSignal,
  ): Promise<ProjectFolderRead>;
  search(
    input: FolderSearch,
    signal?: AbortSignal,
  ): Promise<FolderSearchResult>;
}
