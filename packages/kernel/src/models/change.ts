import { Schema } from 'effect';
export const expectedFileSchema = Schema.Struct({
  path: Schema.mutableKey(Schema.String),
  fingerprint: Schema.mutableKey(
    Schema.Union([Schema.String, Schema.Undefined]),
  ),
});

export type ChangeKind =
  | 'added'
  | 'modified'
  | 'deleted'
  | 'renamed'
  | 'type-changed';

export type ConflictKind =
  | 'both-deleted'
  | 'added-by-us'
  | 'deleted-by-them'
  | 'added-by-them'
  | 'deleted-by-us'
  | 'both-added'
  | 'both-modified';

export type TrackedComparison = {
  scope: 'staged' | 'unstaged';
  kind: ChangeKind;
  oldPath: string | undefined;
  newPath: string | undefined;
  oldMode: string;
  newMode: string;
  oldOid: string | undefined;
  newOid: string | undefined;
  supported: boolean;
};

type UntrackedComparison = { scope: 'untracked'; path: string };

export type UnmergedComparison = {
  scope: 'unmerged';
  path: string;
  conflict: ConflictKind;
  modes: [string, string, string, string];
  oids: [string, string, string];
};

export type ChangeComparison =
  | TrackedComparison
  | UntrackedComparison
  | UnmergedComparison;

export type FileChange = {
  path: string;
  fingerprint: string | undefined;
  comparisons: ChangeComparison[];
};

export type ExpectedFile = typeof expectedFileSchema.Type;

export type ComparisonSides = {
  oldPath?: string | undefined;
  newPath?: string | undefined;
};
