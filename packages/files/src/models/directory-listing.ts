import type { FileFailure } from './file-failure.ts';

export type EntryKind =
  | 'file'
  | 'directory'
  | 'symlink'
  | 'submodule'
  | 'other';

export interface DirectoryEntry {
  name: string;
  kind: EntryKind;
  ignored?: boolean;
  target?: string;
}

export type DirectoryRead =
  | { kind: 'directory'; entries: DirectoryEntry[] }
  | { kind: 'too-large' }
  | { kind: 'failed'; failure: FileFailure };
