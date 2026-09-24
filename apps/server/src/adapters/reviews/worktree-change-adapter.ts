import type {
  ChangeFingerprints,
  ChangeStatusObservation,
  ReadChangeFingerprintsInput,
  WorktreeInput,
} from '@porcelain/changes/models';
import type { Worktree } from '@porcelain/kernel/models';
import type { ReadChangesResult } from '@porcelain/reviews/models';
import type { WorktreeChangeReader } from '@porcelain/reviews/ports';

type ChangeReading = {
  checkWorktree: {
    execute(input: WorktreeInput, signal?: AbortSignal): Promise<Worktree>;
  };
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

export class WorktreeChangeAdapter implements WorktreeChangeReader {
  private readonly changes: ChangeReading;

  constructor(changes: ChangeReading) {
    this.changes = changes;
  }

  async read(
    worktreeId: string,
    signal?: AbortSignal,
  ): Promise<ReadChangesResult> {
    await this.changes.checkWorktree.execute({ worktreeId }, signal);
    const status = await this.changes.readWorktreeStatus.execute(
      { worktreeId },
      signal,
    );
    const { changes } = await this.changes.readChangeFingerprints.execute(
      { worktreeId, comparisons: status.changes, paths: undefined },
      signal,
    );
    await this.changes.checkWorktree.execute({ worktreeId }, signal);
    return {
      worktreeId,
      statusToken: status.statusToken,
      changes,
    };
  }
}
