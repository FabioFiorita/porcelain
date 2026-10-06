import { GitStatusReads } from '../../ports/git-status-reads.ts';
import { type MissingEnvironmentIdentityError } from '@porcelain/access/errors';
import { Context, Effect, Layer } from 'effect';
import { WorktreeAccess } from '../../runtime/worktree-access.ts';
import { type WorktreeAccessFailure } from '../../ports/worktree-access-failure.ts';
import { type GitIoFailure } from '@porcelain/git/errors';
import { ReadEnvironmentService } from '@porcelain/access/services';
import {
  ReadBranchDetailsService,
  ReadWorktreeStatusService,
} from '@porcelain/changes/services';
import { type ReadGitStatusResponse } from '@porcelain/contracts/changes';
import { type WorktreeParams } from '@porcelain/contracts/shared';

export class ReadGitStatusUseCase extends Context.Service<
  ReadGitStatusUseCase,
  {
    readonly execute: (
      input: WorktreeParams,
    ) => Effect.Effect<
      ReadGitStatusResponse,
      WorktreeAccessFailure | GitIoFailure | MissingEnvironmentIdentityError
    >;
  }
>()('@porcelain/server/ReadGitStatusUseCase') {
  static readonly layer = Layer.effect(
    ReadGitStatusUseCase,
    Effect.gen(function* () {
      const accessCapability = yield* WorktreeAccess;
      const readWorktreeStatusCapability = yield* ReadWorktreeStatusService;
      const readBranchDetailsCapability = yield* ReadBranchDetailsService;
      const readEnvironmentCapability = yield* ReadEnvironmentService;
      const sharedReadsCapability = yield* GitStatusReads;

      return {
        execute: Effect.fn('ReadGitStatusUseCase.execute')(function* (
          input: WorktreeParams,
        ): Effect.fn.Return<
          ReadGitStatusResponse,
          WorktreeAccessFailure | GitIoFailure | MissingEnvironmentIdentityError
        > {
          return yield* Effect.suspend(() => {
            const { worktreeId } = input;
            return sharedReadsCapability.run(`status\0${worktreeId}`, () =>
              accessCapability.read(worktreeId, () =>
                Effect.gen(function* () {
                  const status = yield* readWorktreeStatusCapability.execute({
                    worktreeId,
                  });
                  const details = yield* readBranchDetailsCapability.execute({
                    worktreeId,
                    branch: status.branch,
                    headOid: status.headOid,
                  });
                  return {
                    environmentId: (yield* readEnvironmentCapability.execute())
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
          });
        }),
      };
    }),
  );
}
