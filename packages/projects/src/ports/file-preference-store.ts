import type { Effect } from 'effect';
import { Context } from 'effect';
import {
  type FilePreference,
  type FilePreferenceKey,
  type ProjectFilePreference,
} from '../models/file-preference.ts';
import { type ProjectKey } from '../models/project.ts';

export interface FilePreferenceStore {
  list(input: ProjectKey): Effect.Effect<FilePreference[]>;
  find(input: FilePreferenceKey): Effect.Effect<FilePreference | undefined>;
  count(input: ProjectKey): Effect.Effect<number>;
  save(input: ProjectFilePreference): Effect.Effect<void>;
  remove(input: FilePreferenceKey): Effect.Effect<void>;
}

export const FilePreferenceStore = Context.Service<
  '@porcelain/projects/FilePreferenceStore',
  FilePreferenceStore
>('@porcelain/projects/FilePreferenceStore');
