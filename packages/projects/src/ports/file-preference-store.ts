import type {
  FilePreference,
  FilePreferenceKey,
  ProjectFilePreference,
} from '../models/file-preference.ts';
import type { ProjectKey } from '../models/project.ts';

export interface FilePreferenceStore {
  list(input: ProjectKey): FilePreference[];
  find(input: FilePreferenceKey): FilePreference | undefined;
  count(input: ProjectKey): number;
  save(input: ProjectFilePreference): void;
  remove(input: FilePreferenceKey): void;
}
