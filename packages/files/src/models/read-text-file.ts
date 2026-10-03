export type ReadTextFileInput = {
  worktreeId: string;
  path: string;
  at?: 'head' | 'worktree' | undefined;
};

export type ReadTextFileResult = {
  worktreeId: string;
  path: string;
  encoding: 'utf-8';
  byteLength: number;
  text: string;
  contentFingerprint: string;
};

export type ReadTextFileOptions = { maxBytes: number };
