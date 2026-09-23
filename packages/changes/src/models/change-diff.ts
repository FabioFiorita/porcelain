export type ChangeSelection = {
  scope: 'staged' | 'unstaged';
  oldPath: string | null;
  newPath: string | null;
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

export type ExpectedFile = { path: string; fingerprint: string | null };

export type ChangeDiffs = {
  environmentId: string;
  worktreeId: string;
  statusToken: string;
  diffs: ChangeDiff[];
};
