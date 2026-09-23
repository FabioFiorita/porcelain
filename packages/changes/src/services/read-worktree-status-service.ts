import type { ReadWorktreeStatusResult } from '../models/status-observation.ts';
import type { ChangeStatusReader } from '../ports/change-status-reader.ts';

export class ReadWorktreeStatusService {
  private readonly reader: ChangeStatusReader;

  constructor(reader: ChangeStatusReader) {
    this.reader = reader;
  }

  async execute(
    environmentId: string,
    worktreeId: string,
    signal?: AbortSignal,
  ): Promise<ReadWorktreeStatusResult> {
    signal?.throwIfAborted();
    const status = await this.reader.readStatus(signal);
    signal?.throwIfAborted();
    const details = await this.reader.readBranchDetails(
      status.branch?.name ?? undefined,
      status.headOid,
      signal,
    );
    signal?.throwIfAborted();
    return {
      environmentId,
      worktreeId,
      status: {
        ...status,
        headCommit: details.headCommit,
        ...(status.branch
          ? {
              branch: {
                ...status.branch,
                remoteName: details.remoteName,
                sourceRef: details.sourceRef,
                upstreamOid: details.upstreamOid,
                stashes: details.stashes,
                discarded: details.discarded,
              },
            }
          : {}),
      },
    };
  }
}
