import type { FileChange } from '@porcelain/kernel/models';

export type ReviewTexts = ReadonlyMap<string, string>;

export type ReviewText = {
  path: string;
  text: string;
};

export type ReviewDiffSelection = {
  scope: 'staged' | 'unstaged';
  oldPath?: string | undefined;
  newPath?: string | undefined;
};

export type ReviewDiffContent =
  | { kind: 'text'; patch: string }
  | { kind: 'metadata-only'; patch: string }
  | { kind: 'binary' }
  | { kind: 'omitted' };

export type ReviewDiff = {
  selection: ReviewDiffSelection;
  content: ReviewDiffContent;
};

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

export type ReviewEvidence = {
  changes: FileChange[];
  texts: ReviewTexts;
  diffs: ReviewDiff[];
};
