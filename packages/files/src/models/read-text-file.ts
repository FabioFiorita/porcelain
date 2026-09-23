export interface ReadTextFileInput {
  worktreeId: string;
  path: string;
}

export interface ReadTextFileResult {
  worktreeId: string;
  path: string;
  encoding: 'utf-8';
  byteLength: number;
  text: string;
  contentFingerprint: string;
}
