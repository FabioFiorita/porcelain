import type { ReviewedMark } from '../../models/reviewed-file.ts';

export interface ReviewedFileStore {
  list(worktreeId: string): ReviewedMark[];
  set(
    worktreeId: string,
    path: string,
    fingerprint: string,
    reviewedAt: string,
  ): ReviewedMark;
  remove(worktreeId: string, path: string): void;
  /** Conservatively stop the sidebar treating watched content as reviewed. */
  invalidate(worktreeId: string, paths?: readonly string[]): void;
  /** Reconcile conservative watcher invalidations with a fresh change list. */
  reconcile(
    worktreeId: string,
    fingerprints: ReadonlyMap<string, string | null>,
  ): void;
}
