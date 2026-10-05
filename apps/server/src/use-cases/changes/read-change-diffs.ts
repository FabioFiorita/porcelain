import { type MissingEnvironmentIdentityError } from '@porcelain/access/errors';
import { Context, Effect, Layer } from 'effect';
import { WorktreeAccess } from '../../runtime/worktree-access.ts';
import { type WorktreeAccessFailure } from '../../ports/worktree-access-failure.ts';
import { type GitIoFailure } from '@porcelain/git/errors';
import {
  type SelectionMismatchError,
  type UnnamedDiffSelectionError,
  type IncompleteDiffReadError,
} from '@porcelain/changes/errors';
import { ReadEnvironmentService } from '@porcelain/access/services';
import {
  CheckDiffSelectionService,
  ConfirmDiffObservationService,
  ReadChangeDiffsService,
  ReadChangeFingerprintsService,
  ReadWorktreeStatusService,
} from '@porcelain/changes/services';
import {
  type ReadChangeDiffsRequest,
  type ReadChangeDiffsResponse,
} from '@porcelain/contracts/changes';
import { type WorktreeParams } from '@porcelain/contracts/shared';

export class ReadChangeDiffsUseCase extends Context.Service<
  ReadChangeDiffsUseCase,
  {
    readonly execute: (
      input: WorktreeParams & ReadChangeDiffsRequest,
    ) => Effect.Effect<
      ReadChangeDiffsResponse,
      | MissingEnvironmentIdentityError
      | WorktreeAccessFailure
      | GitIoFailure
      | SelectionMismatchError
      | UnnamedDiffSelectionError
      | IncompleteDiffReadError
    >;
  }
>()('@porcelain/server/ReadChangeDiffsUseCase') {
  static readonly layer = Layer.effect(
    ReadChangeDiffsUseCase,
    Effect.gen(function* () {
      const accessCapability = yield* WorktreeAccess;
      const readWorktreeStatusCapability = yield* ReadWorktreeStatusService;
      const readChangeFingerprintsCapability =
        yield* ReadChangeFingerprintsService;
      const checkDiffSelectionCapability = yield* CheckDiffSelectionService;
      const confirmDiffObservationCapability =
        yield* ConfirmDiffObservationService;
      const readChangeDiffsCapability = yield* ReadChangeDiffsService;
      const readEnvironmentCapability = yield* ReadEnvironmentService;

      return {
        execute: Effect.fn('ReadChangeDiffsUseCase.execute')(function* (
          input: WorktreeParams & ReadChangeDiffsRequest,
        ): Effect.fn.Return<
          ReadChangeDiffsResponse,
          | MissingEnvironmentIdentityError
          | WorktreeAccessFailure
          | GitIoFailure
          | SelectionMismatchError
          | UnnamedDiffSelectionError
          | IncompleteDiffReadError
        > {
          return yield* Effect.suspend(() => {
            const {
              worktreeId,
              expectedStatusToken,
              expectedFiles,
              selections,
            } = input;
            return accessCapability.read(worktreeId, () =>
              Effect.gen(function* () {
                const before = yield* readWorktreeStatusCapability.execute({
                  worktreeId,
                });
                const selected = yield* checkDiffSelectionCapability.execute({
                  expectedFiles,
                  selections,
                  status: before,
                });
                const observed =
                  yield* readChangeFingerprintsCapability.execute({
                    worktreeId,
                    comparisons: before.changes,
                    paths: selected.paths,
                  });
                yield* confirmDiffObservationCapability.execute({
                  expectedStatusToken,
                  expectedFiles,
                  statusToken: before.statusToken,
                  fingerprints: observed,
                  previousStamp: undefined,
                });
                const diffs = yield* readChangeDiffsCapability.execute({
                  worktreeId,
                  comparisons: selected.comparisons,
                });
                const after = yield* readWorktreeStatusCapability.execute({
                  worktreeId,
                });
                const reobserved =
                  yield* readChangeFingerprintsCapability.execute({
                    worktreeId,
                    comparisons: after.changes,
                    paths: selected.paths,
                  });
                yield* confirmDiffObservationCapability.execute({
                  expectedStatusToken,
                  expectedFiles,
                  statusToken: after.statusToken,
                  fingerprints: reobserved,
                  previousStamp: observed.stamp,
                });
                return {
                  environmentId: (yield* readEnvironmentCapability.execute())
                    .environmentId,
                  worktreeId,
                  statusToken: before.statusToken,
                  diffs,
                };
              }),
            );
          });
        }),
      };
    }),
  );
}
