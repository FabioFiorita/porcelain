import type { ReadChangesResult } from '@porcelain/changes/models';
import type { WorktreeFingerprintReader } from '@porcelain/git-actions/ports';
import { RequestGitSession } from '@porcelain/git/actions';
import type { GitSession } from '@porcelain/git/inspection';

export type WorktreeChanges = {
  execute(
    worktreeId: string,
    session: GitSession,
    signal?: AbortSignal,
  ): Promise<ReadChangesResult>;
  fingerprints(
    worktreeId: string,
    paths: readonly string[],
    session: GitSession,
    signal?: AbortSignal,
  ): Promise<ReadonlyMap<string, string>>;
};

export class WorktreeFingerprintReaderAdapter implements WorktreeFingerprintReader {
  private readonly changes: WorktreeChanges;

  constructor(changes: WorktreeChanges) {
    this.changes = changes;
  }

  async all(
    worktreeId: string,
    signal?: AbortSignal,
  ): Promise<ReadonlyMap<string, string | undefined>> {
    const observed = await this.changes.execute(
      worktreeId,
      new RequestGitSession(),
      signal,
    );
    return new Map(
      observed.changes.map((change) => [
        change.path,
        change.fingerprint ?? undefined,
      ]),
    );
  }

  selected(
    worktreeId: string,
    paths: readonly string[],
    signal?: AbortSignal,
  ): Promise<ReadonlyMap<string, string>> {
    return this.changes.fingerprints(
      worktreeId,
      paths,
      new RequestGitSession(),
      signal,
    );
  }
}
