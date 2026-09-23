import type {
  FolderSearch,
  FolderSearchResult,
  ProjectFolderContents,
} from '../models/project-folder.ts';

export interface ProjectFolderReader {
  read(path: string, signal?: AbortSignal): Promise<ProjectFolderContents>;
  search(
    search: FolderSearch,
    signal?: AbortSignal,
  ): Promise<FolderSearchResult>;
}
