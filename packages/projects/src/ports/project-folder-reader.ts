import type { ProjectLocation } from '../models/project-location.ts';

export type ProjectFolderContents = {
  path: string;
  parent: string | null;
  directories: (ProjectLocation & { symbolicLink: boolean })[];
  gitMarker: boolean;
  truncated: boolean;
};

export interface ProjectFolderReader {
  read(path: string, signal?: AbortSignal): Promise<ProjectFolderContents>;
}
