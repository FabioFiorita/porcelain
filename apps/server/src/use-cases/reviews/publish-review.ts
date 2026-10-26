import {
  type ReviewDraftFailure,
  ValidateReviewDraftService,
  PublishReviewService,
  ResolvePublishedReviewService,
} from '@porcelain/reviews/services';
import { type MissingEnvironmentIdentityError } from '@porcelain/access/errors';
import { type GitIoFailure } from '@porcelain/git/errors';
import {
  type IncompleteDiffReadError,
  type CommitNotFoundError,
} from '@porcelain/changes/errors';
import {
  type ReviewPublishRefusedError,
  type InvalidReviewPointerError,
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

import {
  ReadBranchChangesService,
  ReadWorktreeStatusService,
} from '@porcelain/changes/services';
import { ReadRepositoryOriginService } from '@porcelain/projects/services';
import { type ReviewPublicationInput } from '@porcelain/reviews/models';
import { ReviewLinkSource } from '../../ports/review-link-source.ts';
import {
  BuildReviewLinksService,
  ValidateReviewPublicationService,
} from '@porcelain/reviews/services';
import { reviewDirtyPaths, proofFilePaths } from '@porcelain/reviews/rules';
import { EventPublisher } from '../../ports/event-publisher.ts';
import { ReadReviewEvidenceUseCasePort } from '../../ports/read-review-evidence-use-case-port.ts';

export class PublishReviewUseCase extends Context.Service<
  PublishReviewUseCase,
  {
    readonly execute: (
      input: WorktreeParams & PublishReviewRequest,
    ) => Effect.Effect<
      PublishReviewToolResponse,
      | ReviewPublishRefusedError
      | MissingEnvironmentIdentityError
      | WorktreeAccessFailure
      | ReviewDraftFailure
      | InvalidReviewPointerError
      | ReviewConflictError
      | ProofTooLargeError
      | UnknownProofFileError
      | UnsupportedProofFileError
      | ProofFileUnreadableError
      | GitIoFailure
      | CommitNotFoundError
      | IncompleteDiffReadError
    >;
  }
>()('@porcelain/server/PublishReviewUseCase') {
  static readonly layer = Layer.effect(
    PublishReviewUseCase,
    Effect.gen(function* () {
      const accessCapability = yield* WorktreeAccess;
      const validateReviewDraftCapability = yield* ValidateReviewDraftService;
      const branches = yield* ReadBranchChangesService;
      const publication = yield* ValidateReviewPublicationService;
      const routes = yield* ReviewLinkSource;
      const statusReader = yield* ReadWorktreeStatusService;
      const origins = yield* ReadRepositoryOriginService;
      const links = yield* BuildReviewLinksService;
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
          | ReviewPublishRefusedError
          | MissingEnvironmentIdentityError
          | WorktreeAccessFailure
          | ReviewDraftFailure
          | InvalidReviewPointerError
          | ReviewConflictError
          | ProofTooLargeError
          | UnknownProofFileError
          | UnsupportedProofFileError
          | ProofFileUnreadableError
          | GitIoFailure
          | CommitNotFoundError
          | IncompleteDiffReadError
        > {
          return yield* Effect.suspend(() => {
            const { worktreeId, ...unvalidatedDraft } = input;
            return accessCapability.transaction(
              worktreeId,
              (worktree) =>
                Effect.gen(function* () {
                  const draft =
                    yield* validateReviewDraftCapability.execute(
                      unvalidatedDraft,
                    );
                  const read = yield* branches
                    .execute({ worktreeId, base: draft.base })
                    .pipe(
                      Effect.map((range) => ({
                        kind: 'range' as const,
                        range,
                      })),
                      Effect.catchTags({
                        UnbornBranchError: () =>
                          Effect.succeed({ kind: 'unborn' as const }),
                        BranchBaseNotFoundError: () =>
                          Effect.succeed({ kind: 'base-unavailable' as const }),
                        UnrelatedBranchError: () =>
                          Effect.succeed({ kind: 'base-unavailable' as const }),
                      }),
                    );
                  const status = yield* statusReader.execute({ worktreeId });
                  const origin = yield* origins.execute({
                    path: worktree.path,
                  });
                  const publicationStatus: ReviewPublicationInput['status'] =
                    read.kind !== 'range'
                      ? read
                      : read.range.head.branch === undefined
                        ? { kind: 'detached' }
                        : read.range.base === undefined ||
                            read.range.mergeBaseOid === undefined
                          ? { kind: 'base-unavailable' }
                          : {
                              kind: 'ready',
                              commit: {
                                projectId: worktree.projectId,
                                commonDirectory: worktree.commonDirectory,
                                branch: read.range.head.branch.replace(
                                  /^refs\/heads\//,
                                  '',
                                ),
                                worktreePath: worktree.path,
                                worktreeName:
                                  worktree.path.split('/').at(-1) ??
                                  worktree.path,
                                headOid: read.range.head.oid,
                                base: read.range.base.ref,
                                baseOid: read.range.base.oid,
                                mergeBaseOid: read.range.mergeBaseOid,
                                files: read.range.files,
                              },
                            };
                  const commit = yield* publication.execute({
                    status: publicationStatus,
                    dirtyPaths: reviewDirtyPaths(status.changes),
                    proofPaths: proofFilePaths(draft.proof),
                    verdict: draft.verdict,
                    origin: origin.originUrl,
                    pullRequest: draft.pullRequest,
                  });
                  const evidence = yield* readReviewEvidenceCapability.execute({
                    worktreeId,
                    layers: draft.layers,
                    revision: commit,
                  });
                  const proofFiles = yield* readBinaryFilesCapability.execute({
                    worktreeId,
                    paths: proofFilePaths(draft.proof),
                  });
                  const environment =
                    yield* readEnvironmentCapability.execute();
                  return { draft, commit, evidence, proofFiles, environment };
                }),
              ({ draft, commit, evidence, proofFiles, environment }) =>
                Effect.gen(function* () {
                  const { review, warnings } =
                    yield* publishReviewCapability.execute({
                      worktreeId,
                      commit,
                      draft,
                      evidence,
                      proofFiles,
                    });
                  return {
                    reviewId: review.reviewId,
                    revision: review.revision,
                    headOid: review.headOid,
                    baseOid: review.baseOid,
                    links: yield* links.execute({
                      review,
                      environmentId: environment.environmentId,
                      routes: yield* routes.read(),
                    }),
                    review: yield* resolvePublishedReviewCapability.execute({
                      environmentId: environment.environmentId,
                      review,
                      headOid: review.headOid,
                    }),
                    warnings,
                  };
                }),
              () =>
                Effect.andThen(
                  eventsCapability.worktreeChanged({
                    worktreeId,
                    change: 'review',
                  }),
                  eventsCapability.inventoryChanged(),
                ),
            );
          });
        }),
      };
    }),
  );
}
