import type {
  FolderSearch,
  FolderSearchResult,
  ProjectFolderRead,
} from '../models/project-folder.ts';

export interface ProjectFolderReader {
  read(path: string, signal?: AbortSignal): Promise<ProjectFolderRead>;
  search(
    search: FolderSearch,
    signal?: AbortSignal,
  ): Promise<FolderSearchResult>;
}
