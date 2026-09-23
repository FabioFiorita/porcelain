import type { TrackedComparison } from './change.ts';

export type ChangeSelection = {
  scope: 'staged' | 'unstaged';
  oldPath: string | undefined;
  newPath: string | undefined;
};

export type ChangeDiffContent =
  | { kind: 'text'; patch: string }
  | { kind: 'binary' }
  | { kind: 'metadata-only'; patch: string }
  | {
      kind: 'omitted';
      reason: 'size-limit' | 'unsupported-encoding' | 'unsupported-submodule';
    };

export type ChangeDiff = {
  selection: ChangeSelection;
  content: ChangeDiffContent;
};

export type ExpectedFile = { path: string; fingerprint: string | undefined };

export type DiffSelection = {
  comparisons: TrackedComparison[];
  paths: string[];
};

export type ChangeDiffs = {
  environmentId: string;
  worktreeId: string;
  statusToken: string;
  diffs: ChangeDiff[];
};
