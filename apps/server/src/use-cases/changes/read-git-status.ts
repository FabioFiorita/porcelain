import type { MissingEnvironmentIdentityError } from '@porcelain/access/errors';
import type { Context } from 'effect';
import { Effect } from 'effect';
import type { WorktreeAccess } from '../../runtime/worktree-access.ts';
import type { WorktreeAccessFailure } from '../../ports/worktree-access-failure.ts';
import type { GitIoFailure } from '../../ports/git-io-failure.ts';
import type { ReadEnvironmentService } from '@porcelain/access/services';
import type {
  ReadBranchDetailsService,
  ReadWorktreeStatusService,
} from '@porcelain/changes/services';
import type { ReadGitStatusResponse } from '@porcelain/contracts/changes';
import type { WorktreeParams } from '@porcelain/contracts/shared';
import type { SharedReads } from '../../runtime/shared-reads.ts';

export class ReadGitStatusUseCase {
  private readonly access: WorktreeAccess;
  private readonly readWorktreeStatus: ReadWorktreeStatusService<GitIoFailure>;
  private readonly readBranchDetails: ReadBranchDetailsService<GitIoFailure>;
  private readonly readEnvironment: Context.Service.Shape<
    typeof ReadEnvironmentService
  >;
  private readonly sharedReads: SharedReads<
    ReadGitStatusResponse,
    WorktreeAccessFailure | GitIoFailure | MissingEnvironmentIdentityError
  >;

  constructor(
    access: WorktreeAccess,
    readWorktreeStatus: ReadWorktreeStatusService<GitIoFailure>,
    readBranchDetails: ReadBranchDetailsService<GitIoFailure>,
    readEnvironment: Context.Service.Shape<typeof ReadEnvironmentService>,
    sharedReads: SharedReads<
      ReadGitStatusResponse,
      WorktreeAccessFailure | GitIoFailure | MissingEnvironmentIdentityError
    >,
  ) {
    this.access = access;
    this.readWorktreeStatus = readWorktreeStatus;
    this.readBranchDetails = readBranchDetails;
    this.readEnvironment = readEnvironment;
    this.sharedReads = sharedReads;
  }

  execute(
    input: WorktreeParams,
  ): Effect.Effect<
    ReadGitStatusResponse,
    WorktreeAccessFailure | GitIoFailure | MissingEnvironmentIdentityError
  > {
    const { worktreeId } = input;
    return this.sharedReads.run(`status\0${worktreeId}`, () =>
      this.access.read(worktreeId, () =>
        Effect.gen({ self: this }, function* () {
          const status = yield* this.readWorktreeStatus.execute({ worktreeId });
          const details = yield* this.readBranchDetails.execute({
            worktreeId,
            branch: status.branch,
            headOid: status.headOid,
          });
          return {
            environmentId: (yield* this.readEnvironment.execute())
              .environmentId,
            worktreeId,
            statusToken: status.statusToken,
            branch: status.branch && {
              ...status.branch,
              remoteName: details.remoteName,
              sourceRef: details.sourceRef,
              upstreamOid: details.upstreamOid,
              stashes: details.stashes,
              discarded: details.discarded,
            },
            consistency: 'best-effort',
            headOid: status.headOid,
            inProgress: status.inProgress,
            mergeHeadOid: status.mergeHeadOid,
            headCommit: details.headCommit,
            changes: status.changes,
          };
        }),
      ),
    );
  }
}
