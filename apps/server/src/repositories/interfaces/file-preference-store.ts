import type {
  FilePreference,
  FilePreferenceChange,
} from '../../models/file-preference.ts';
export interface FilePreferenceStore {
  list(projectId: string): FilePreference[];
  set(projectId: string, change: FilePreferenceChange): void;
}
