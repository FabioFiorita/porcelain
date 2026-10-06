import { GenerateCommitDraftUseCaseOptions } from '../../ports/generate-commit-draft-use-case-options.ts';
import { Effect, Context, Layer } from 'effect';
import {
  ConfirmDiffObservationService,
  ReadChangeFingerprintsService,
  ReadWorktreeStatusService,
} from '@porcelain/changes/services';
import {
  type GenerateCommitDraftRequest,
  type GenerateCommitDraftResponse,
} from '@porcelain/contracts/git-actions';
import { type WorktreeParams } from '@porcelain/contracts/shared';
import {
  CaptureCommitDraftService,
  GenerateCommitDraftService,
} from '@porcelain/git-actions/services';
import { Lanes } from '../../runtime/lanes.ts';
import { WorktreeAccess } from '../../runtime/worktree-access.ts';
import { type WorktreeAccessFailure } from '../../ports/worktree-access-failure.ts';
import { type GitIoFailure } from '@porcelain/git/errors';

export class GenerateCommitDraftUseCase extends Context.Service<
  GenerateCommitDraftUseCase,
  {
    readonly execute: (
      input: WorktreeParams & GenerateCommitDraftRequest,
    ) => Effect.Effect<
      GenerateCommitDraftResponse,
      | WorktreeAccessFailure
      | GitIoFailure
      | Effect.Error<
          ReturnType<
            Context.Service.Shape<typeof CaptureCommitDraftService>['execute']
          >
        >
      | Effect.Error<
          ReturnType<
            Context.Service.Shape<typeof GenerateCommitDraftService>['execute']
          >
        >
    >;
  }
>()('@porcelain/server/GenerateCommitDraftUseCase') {
  static readonly layer = Layer.effect(
    GenerateCommitDraftUseCase,
    Effect.gen(function* () {
      const accessCapability = yield* WorktreeAccess;
      const readWorktreeStatusCapability = yield* ReadWorktreeStatusService;
      const readChangeFingerprintsCapability =
        yield* ReadChangeFingerprintsService;
      const confirmDiffObservationCapability =
        yield* ConfirmDiffObservationService;
      const captureCommitDraftCapability = yield* CaptureCommitDraftService;
      const generateCommitDraftCapability = yield* GenerateCommitDraftService;
      const lanesCapability = yield* Lanes;
      const optionsCapability = yield* GenerateCommitDraftUseCaseOptions;

      return {
        execute: Effect.fn('GenerateCommitDraftUseCase.execute')(function* (
          input: WorktreeParams & GenerateCommitDraftRequest,
        ): Effect.fn.Return<
          GenerateCommitDraftResponse,
          | WorktreeAccessFailure
          | GitIoFailure
          | Effect.Error<
              ReturnType<
                Context.Service.Shape<
                  typeof CaptureCommitDraftService
                >['execute']
              >
            >
          | Effect.Error<
              ReturnType<
                Context.Service.Shape<
                  typeof GenerateCommitDraftService
                >['execute']
              >
            >
        > {
          const { worktreeId } = input;
          const capture = yield* accessCapability.read(worktreeId, () =>
            Effect.gen(function* () {
              const status = yield* readWorktreeStatusCapability.execute({
                worktreeId,
              });
              const fingerprints =
                yield* readChangeFingerprintsCapability.execute({
                  worktreeId,
                  comparisons: status.changes,
                  paths: undefined,
                });
              yield* confirmDiffObservationCapability.execute({
                expectedStatusToken: input.expectedStatusToken,
                expectedFiles: [],
                statusToken: status.statusToken,
                fingerprints,
                previousStamp: undefined,
              });
              return yield* captureCommitDraftCapability.execute({
                worktreeId,
                observation: {
                  headOid: status.headOid,
                  changes: fingerprints.changes,
                },
                paths: input.paths,
              });
            }),
          );
          return yield* lanesCapability.unqueued(
            () =>
              generateCommitDraftCapability.execute({
                capture,
                mode: input.mode,
                model: input.model,
              }),
            optionsCapability,
          );
        }),
      };
    }),
  );
}
