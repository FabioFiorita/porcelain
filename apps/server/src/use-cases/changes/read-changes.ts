import { type MissingEnvironmentIdentityError } from '@porcelain/access/errors';
import { Context, Effect, Layer } from 'effect';
import { WorktreeAccess } from '../../runtime/worktree-access.ts';
import { type WorktreeAccessFailure } from '../../ports/worktree-access-failure.ts';
import { type GitIoFailure } from '@porcelain/git/errors';
import { ReadEnvironmentService } from '@porcelain/access/services';
import {
  ReadChangeFingerprintsService,
  ReadWorktreeStatusService,
} from '@porcelain/changes/services';
import { type ReadChangesResponse } from '@porcelain/contracts/changes';
import { type WorktreeParams } from '@porcelain/contracts/shared';
import { ReadInterruptedGitActionService } from '@porcelain/git-actions/services';

export class ReadChangesUseCase extends Context.Service<
  ReadChangesUseCase,
  {
    readonly execute: (
      input: WorktreeParams,
    ) => Effect.Effect<
      ReadChangesResponse,
      MissingEnvironmentIdentityError | WorktreeAccessFailure | GitIoFailure
    >;
  }
>()('@porcelain/server/ReadChangesUseCase') {
  static readonly layer = Layer.effect(
    ReadChangesUseCase,
    Effect.gen(function* () {
      const accessCapability = yield* WorktreeAccess;
      const readWorktreeStatusCapability = yield* ReadWorktreeStatusService;
      const readChangeFingerprintsCapability =
        yield* ReadChangeFingerprintsService;
      const readInterruptedGitActionCapability =
        yield* ReadInterruptedGitActionService;
      const readEnvironmentCapability = yield* ReadEnvironmentService;

      return {
        execute: Effect.fn('ReadChangesUseCase.execute')(function* (
          input: WorktreeParams,
        ): Effect.fn.Return<
          ReadChangesResponse,
          MissingEnvironmentIdentityError | WorktreeAccessFailure | GitIoFailure
        > {
          return yield* Effect.suspend(() => {
            const { worktreeId } = input;
            return accessCapability.read(worktreeId, () =>
              Effect.gen(function* () {
                const status = yield* readWorktreeStatusCapability.execute({
                  worktreeId,
                });
                const { changes } =
                  yield* readChangeFingerprintsCapability.execute({
                    worktreeId,
                    comparisons: status.changes,
                    paths: undefined,
                  });
                const interrupted =
                  yield* readInterruptedGitActionCapability.execute({
                    worktreeId,
                  });
                return {
                  environmentId: (yield* readEnvironmentCapability.execute())
                    .environmentId,
                  worktreeId,
                  statusToken: status.statusToken,
                  headOid: status.headOid,
                  inProgress: status.inProgress,
                  mergeHeadOid: status.mergeHeadOid,
                  branch: status.branch,
                  changes,
                  ...(interrupted.kind === 'interrupted' && {
                    interrupted: {
                      requestId: interrupted.receipt.requestId,
                      action: interrupted.receipt.action,
                    },
                  }),
                };
              }),
            );
          });
        }),
      };
    }),
  );
}
