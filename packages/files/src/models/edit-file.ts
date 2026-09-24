import type { FileEdit } from './file-edit.ts';

export type EditFileInput = {
  worktreeId: string;
  command: FileEdit;
};

export type EditFileResult = {
  path: string;
  contentFingerprint?: string | undefined;
};
