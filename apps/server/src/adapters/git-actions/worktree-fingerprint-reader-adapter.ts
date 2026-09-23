import type {
  ChangeFingerprints,
  ChangeStatusObservation,
  FileChange,
  ReadChangeFingerprintsInput,
  WorktreeInput,
} from '@porcelain/changes/models';
import type { WorktreeFingerprintReader } from '@porcelain/git-actions/ports';

export type WorktreeChangeReading = {
  readWorktreeStatus: {
    execute(
      input: WorktreeInput,
      signal?: AbortSignal,
    ): Promise<ChangeStatusObservation>;
  };
  readChangeFingerprints: {
    execute(
      input: ReadChangeFingerprintsInput,
      signal?: AbortSignal,
    ): Promise<ChangeFingerprints>;
  };
};

export class WorktreeFingerprintReaderAdapter implements WorktreeFingerprintReader {
  private readonly changes: WorktreeChangeReading;

  constructor(changes: WorktreeChangeReading) {
    this.changes = changes;
  }

  async all(
    worktreeId: string,
    signal?: AbortSignal,
  ): Promise<ReadonlyMap<string, string | undefined>> {
    const changes = await this.read(worktreeId, undefined, signal);
    return new Map(changes.map((change) => [change.path, change.fingerprint]));
  }

  async selected(
    worktreeId: string,
    paths: readonly string[],
    signal?: AbortSignal,
  ): Promise<ReadonlyMap<string, string>> {
    const changes = await this.read(worktreeId, paths, signal);
    return new Map(
      changes.flatMap((change): [string, string][] =>
        change.fingerprint === undefined
          ? []
          : [[change.path, change.fingerprint]],
      ),
    );
  }

  private async read(
    worktreeId: string,
    paths: readonly string[] | undefined,
    signal: AbortSignal | undefined,
  ): Promise<FileChange[]> {
    const status = await this.changes.readWorktreeStatus.execute(
      { worktreeId },
      signal,
    );
    const observed = await this.changes.readChangeFingerprints.execute(
      { worktreeId, comparisons: status.changes, paths },
      signal,
    );
    return observed.changes;
  }
}
