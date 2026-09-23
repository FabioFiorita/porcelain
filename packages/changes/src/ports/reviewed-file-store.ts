export interface ReviewedFileStore {
  reconcile(
    worktreeId: string,
    fingerprints: ReadonlyMap<string, string>,
  ): void;
}
