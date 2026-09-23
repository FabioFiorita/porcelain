import type { ReviewedFileStore } from '@porcelain/changes/ports';

export class InMemoryReviewedFileStore implements ReviewedFileStore {
  readonly reconciled = new Map<string, ReadonlyMap<string, string>>();

  reconcile(worktreeId: string, fingerprints: ReadonlyMap<string, string>) {
    this.reconciled.set(worktreeId, new Map(fingerprints));
  }
}
