export type ReadBinaryFilesInput = {
  worktreeId: string;
  paths: readonly string[];
};

export type ReadBinaryFilesResult = {
  files: ReadonlyMap<string, Uint8Array>;
  tooLarge: string[];
  unreadable: string[];
};

export type ReadBinaryFilesOptions = { maxBytes: number };
