export type ReadTextFileInput = {
  worktreeId: string;
  path: string;
};

export type ReadTextFileResult = {
  worktreeId: string;
  path: string;
  encoding: 'utf-8';
  byteLength: number;
  text: string;
  contentFingerprint: string;
};
