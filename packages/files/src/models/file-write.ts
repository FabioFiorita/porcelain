import type { WriteFailure } from './file-failure.ts';

export type FileWriteInput = {
  worktreeId: string;
  path: string;
  text: string;
  revision: string;
};

export type EntryCreateInput = {
  worktreeId: string;
  path: string;
  entryKind: 'file' | 'directory';
};

export type EntryMoveInput = {
  worktreeId: string;
  path: string;
  destination: string;
};

export type FileWrite =
  | { kind: 'written' }
  | { kind: 'failed'; failure: WriteFailure };
