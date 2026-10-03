export type MarkCommentsSeenInput = {
  worktreeId: string;
  throughRevision: number;
};

export type MarkCommentsSeenResult = {
  worktreeId: string;
  seenThrough: number;
  changed: boolean;
};
