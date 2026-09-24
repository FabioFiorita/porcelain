export type ReconcileReviewedFilesInput = {
  worktreeId: string;
  fingerprints: ReadonlyMap<string, string | undefined>;
};
