export type ReadTextFilesInput = {
  worktreeId: string;
  paths: readonly string[];
};

export type ReadTextFilesResult = {
  texts: ReadonlyMap<string, string>;
  unreadable: string[];
  missing: ReadonlySet<string>;
};

export type ReadTextFilesOptions = { maxBytes: number };
