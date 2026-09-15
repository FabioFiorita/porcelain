import type { ProjectLocation } from '../../models/project-location.ts';

export type FolderContents = {
  path: string;
  parent: string | null;
  directories: (ProjectLocation & { symbolicLink: boolean })[];
  gitMarker: boolean;
  truncated: boolean;
};

export interface ProjectFolders {
  read(path: string, signal?: AbortSignal): Promise<FolderContents>;
}
