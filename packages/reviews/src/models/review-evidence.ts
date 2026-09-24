import type { ExpectedFile, FileChange } from '@porcelain/kernel/models';

export type ReadChangesResult = {
  worktreeId: string;
  statusToken: string;
  changes: FileChange[];
};

export type ChangeSelection = {
  scope: 'staged' | 'unstaged';
  oldPath?: string | undefined;
  newPath?: string | undefined;
};

export type ChangeDiffContent =
  | { kind: 'text'; patch: string }
  | { kind: 'metadata-only'; patch: string }
  | { kind: 'binary' }
  | { kind: 'omitted' };

export type ChangeDiff = {
  selection: ChangeSelection;
  content: ChangeDiffContent;
};

export type ChangeDiffs = {
  diffs: ChangeDiff[];
};

export type DiffBatch = {
  expectedFiles: ExpectedFile[];
  selections: ChangeSelection[];
};

export type ReviewFiles = ReadonlyMap<string, string>;

export type ReviewChange = {
  path: string;
  untracked: boolean;
  deleted: boolean;
};

export type ReviewPatch =
  | { path: string; scope: 'staged' | 'unstaged'; kind: 'text'; patch: string }
  | { path: string; scope: 'staged' | 'unstaged'; kind: 'binary' };

export type ReviewDiagnostics = {
  changed: ReadonlyMap<string, ReadonlySet<number>>;
  deleted: ReadonlyMap<string, ReadonlySet<number>>;
  binary: ReadonlySet<string>;
};
