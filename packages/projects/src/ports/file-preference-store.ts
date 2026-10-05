import { Context } from 'effect';
import {
  type FilePreference,
  type FilePreferenceKey,
  type ProjectFilePreference,
} from '../models/file-preference.ts';
import { type ProjectKey } from '../models/project.ts';

export interface FilePreferenceStore {
  list(input: ProjectKey): FilePreference[];
  find(input: FilePreferenceKey): FilePreference | undefined;
  count(input: ProjectKey): number;
  save(input: ProjectFilePreference): void;
  remove(input: FilePreferenceKey): void;
}

export const FilePreferenceStore = Context.Service<
  '@porcelain/projects/FilePreferenceStore',
  FilePreferenceStore
>('@porcelain/projects/FilePreferenceStore');
