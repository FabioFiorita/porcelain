import { assembleChanges } from '../models/assemble-changes.ts';
import type { ReadChangesResult } from '../models/change-list.ts';
import type { ChangeInspectionReader } from '../ports/change-inspection-reader.ts';

export class ReadWorktreeChangesService {
  private readonly reader: ChangeInspectionReader;

  constructor(reader: ChangeInspectionReader) {
    this.reader = reader;
  }

  async execute(
    worktreeId: string,
    signal?: AbortSignal,
  ): Promise<ReadChangesResult> {
    signal?.throwIfAborted();
    const { environmentId, status: observed } =
      await this.reader.readStatus(signal);
    signal?.throwIfAborted();
    const { sides } = await this.reader.observeSides(observed.changes, signal);
    const changes = assembleChanges(observed.changes, sides).map((change) => ({
      ...change,
      fingerprint: change.fingerprint ?? this.reader.missingFingerprint,
    }));
    await this.reader.confirmReachable(worktreeId, signal);
    return {
      environmentId,
      worktreeId,
      statusToken: observed.statusToken,
      headOid: observed.headOid,
      inProgress: observed.inProgress,
      mergeHeadOid: observed.mergeHeadOid,
      branch: observed.branch
        ? {
            name: observed.branch.name,
            upstream: observed.branch.upstream,
            ahead: observed.branch.ahead,
            behind: observed.branch.behind,
          }
        : observed.branch,
      changes,
    };
  }
}
