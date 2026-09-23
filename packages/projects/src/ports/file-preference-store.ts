import type { FilePreference } from '../models/file-preference.ts';

export interface FilePreferenceStore {
  list(projectId: string): FilePreference[];
  find(projectId: string, path: string): FilePreference | undefined;
  count(projectId: string): number;
  save(projectId: string, preference: FilePreference): void;
  remove(projectId: string, path: string): void;
}
