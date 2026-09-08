import type {
  FilePreference,
  FilePreferenceChange,
} from '../../models/file-preference.ts';
export interface FilePreferenceStore {
  list(worktreeId: string): FilePreference[];
  set(worktreeId: string, change: FilePreferenceChange): void;
}
