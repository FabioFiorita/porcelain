import {
  type ReviewDraftFailure,
  ValidateReviewDraftService,
  CheckReviewDraftService,
  PublishReviewService,
  ResolvePublishedReviewService,
} from '@porcelain/reviews/services';
import { type MissingEnvironmentIdentityError } from '@porcelain/access/errors';
import { type GitIoFailure } from '@porcelain/git/errors';
import { type IncompleteDiffReadError } from '@porcelain/changes/errors';
import {
  type ReviewConflictError,
  type ProofTooLargeError,
  type UnknownProofFileError,
  type UnsupportedProofFileError,
  type ProofFileUnreadableError,
} from '@porcelain/reviews/errors';
import { Context, Effect, Layer } from 'effect';
import { WorktreeAccess } from '../../runtime/worktree-access.ts';
import { type WorktreeAccessFailure } from '../../ports/worktree-access-failure.ts';
import { ReadEnvironmentService } from '@porcelain/access/services';
import {
  type PublishReviewRequest,
  type PublishReviewToolResponse,
} from '@porcelain/contracts/reviews';
import { type WorktreeParams } from '@porcelain/contracts/shared';
import { ReadBinaryFilesService } from '@porcelain/files/services';
import { proofFilePaths } from '@porcelain/reviews/rules';
import { EventPublisher } from '../../ports/event-publisher.ts';
import { ReadReviewEvidenceUseCasePort } from '../../ports/read-review-evidence-use-case-port.ts';

export class PublishReviewUseCase extends Context.Service<
  PublishReviewUseCase,
  {
    readonly execute: (
      input: WorktreeParams & PublishReviewRequest,
    ) => Effect.Effect<
      PublishReviewToolResponse,
      | MissingEnvironmentIdentityError
      | WorktreeAccessFailure
      | ReviewDraftFailure
      | ReviewConflictError
      | ProofTooLargeError
      | UnknownProofFileError
      | UnsupportedProofFileError
      | ProofFileUnreadableError
      | GitIoFailure
      | IncompleteDiffReadError
    >;
  }
>()('@porcelain/server/PublishReviewUseCase') {
  static readonly layer = Layer.effect(
    PublishReviewUseCase,
    Effect.gen(function* () {
      const accessCapability = yield* WorktreeAccess;
      const validateReviewDraftCapability = yield* ValidateReviewDraftService;
      const checkReviewDraftCapability = yield* CheckReviewDraftService;
      const readReviewEvidenceCapability = yield* ReadReviewEvidenceUseCasePort;
      const readBinaryFilesCapability = yield* ReadBinaryFilesService;
      const publishReviewCapability = yield* PublishReviewService;
      const readEnvironmentCapability = yield* ReadEnvironmentService;
      const resolvePublishedReviewCapability =
        yield* ResolvePublishedReviewService;
      const eventsCapability = yield* EventPublisher;

      return {
        execute: Effect.fn('PublishReviewUseCase.execute')(function* (
          input: WorktreeParams & PublishReviewRequest,
        ): Effect.fn.Return<
          PublishReviewToolResponse,
          | MissingEnvironmentIdentityError
          | WorktreeAccessFailure
          | ReviewDraftFailure
          | ReviewConflictError
          | ProofTooLargeError
          | UnknownProofFileError
          | UnsupportedProofFileError
          | ProofFileUnreadableError
          | GitIoFailure
          | IncompleteDiffReadError
        > {
          return yield* Effect.suspend(() => {
            const { worktreeId, ...unvalidatedDraft } = input;
            return accessCapability.transaction(
              worktreeId,
              () =>
                Effect.gen(function* () {
                  const draft =
                    yield* validateReviewDraftCapability.execute(
                      unvalidatedDraft,
                    );
                  yield* checkReviewDraftCapability.execute({
                    worktreeId,
                    draft,
                  });
                  const evidence = yield* readReviewEvidenceCapability.execute({
                    worktreeId,
                    layers: draft.layers,
                  });
                  const proofFiles = yield* readBinaryFilesCapability.execute({
                    worktreeId,
                    paths: proofFilePaths(draft.proof),
                  });
                  const environment =
                    yield* readEnvironmentCapability.execute();
                  return { draft, evidence, proofFiles, environment };
                }),
              ({ draft, evidence, proofFiles, environment }) =>
                Effect.gen(function* () {
                  const { review, warnings } =
                    yield* publishReviewCapability.execute({
                      worktreeId,
                      draft,
                      evidence,
                      proofFiles,
                    });
                  return {
                    review: yield* resolvePublishedReviewCapability.execute({
                      environmentId: environment.environmentId,
                      review,
                      evidence,
                    }),
                    warnings,
                  };
                }),
              () =>
                Effect.sync(() =>
                  eventsCapability.worktreeChanged({
                    worktreeId,
                    change: 'review',
                  }),
                ),
            );
          });
        }),
      };
    }),
  );
}
