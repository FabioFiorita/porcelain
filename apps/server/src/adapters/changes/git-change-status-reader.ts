import type { Effect } from 'effect';
import type { WorktreeRead } from '@porcelain/effects/worktree';
import { readGit } from '../../runtime/git-io.ts';
import type { GitIoFailure } from '../../ports/git-io-failure.ts';
import type {
  BranchDetails,
  BranchDetailsRequest,
  ChangeStatusObservation,
  ReadWorktreeStatusInput,
} from '@porcelain/changes/models';
import type { ChangeStatusReader } from '@porcelain/changes/ports';
import { fromGitChange } from './git-comparisons.ts';
import type { OpenInspection } from './inspection-checkouts.ts';

export class GitChangeStatusReader implements ChangeStatusReader<GitIoFailure> {
  private readonly open: OpenInspection;

  constructor(open: OpenInspection) {
    this.open = open;
  }

  readStatus(
    input: ReadWorktreeStatusInput,
  ): Effect.Effect<ChangeStatusObservation, GitIoFailure, WorktreeRead> {
    return readGit(input.worktreeId, (signal) =>
      this.readStatusNative(input, signal),
    );
  }

  private async readStatusNative(
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

  readBranchDetails(
    input: BranchDetailsRequest,
  ): Effect.Effect<BranchDetails, GitIoFailure, WorktreeRead> {
    return readGit(input.worktreeId, (signal) =>
      this.readBranchDetailsNative(input, signal),
    );
  }

  private async readBranchDetailsNative(
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
