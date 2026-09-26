import type {
  BranchDetails,
  BranchDetailsRequest,
  ChangeStatusObservation,
  ReadWorktreeStatusInput,
} from '@porcelain/changes/models';
import type { ChangeStatusReader } from '@porcelain/changes/ports';
import { fromGitChange } from './git-comparisons.ts';
import type { OpenInspection } from './inspection-checkouts.ts';

export class GitChangeStatusReader implements ChangeStatusReader {
  private readonly open: OpenInspection;

  constructor(open: OpenInspection) {
    this.open = open;
  }

  async readStatus(
    input: ReadWorktreeStatusInput,
    signal?: AbortSignal,
  ): Promise<ChangeStatusObservation> {
    const { git } = await this.open(input.worktreeId, signal);
    const status = await git.readStatus(signal);
    return {
      statusToken: status.statusToken,
      headOid: status.headOid ?? undefined,
      inProgress: status.inProgress ?? undefined,
      mergeHeadOid: status.mergeHeadOid ?? undefined,
      branch: status.branch && {
        name: status.branch.name ?? undefined,
        upstream: status.branch.upstream ?? undefined,
        ahead: status.branch.ahead,
        behind: status.branch.behind,
      },
      changes: status.changes.map(fromGitChange),
    };
  }

  async readBranchDetails(
    input: BranchDetailsRequest,
    signal?: AbortSignal,
  ): Promise<BranchDetails> {
    const { git } = await this.open(input.worktreeId, signal);
    const details = await git.readBranchDetails(
      input.branchName ?? null,
      input.headOid ?? null,
      signal,
    );
    return {
      remoteName: details.remoteName ?? undefined,
      sourceRef: details.sourceRef ?? undefined,
      upstreamOid: details.upstreamOid ?? undefined,
      stashes: details.stashes,
      discarded: details.discarded,
      headCommit: details.headCommit ?? undefined,
    };
  }
}
