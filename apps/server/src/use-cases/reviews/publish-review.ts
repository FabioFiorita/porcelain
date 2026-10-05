import type { ReviewDraftFailure } from '@porcelain/reviews/services';
import type { MissingEnvironmentIdentityError } from '@porcelain/access/errors';
import type { GitIoFailure } from '../../ports/git-io-failure.ts';
import type { IncompleteDiffReadError } from '@porcelain/changes/errors';
import type {
  ReviewConflictError,
  ProofTooLargeError,
  UnknownProofFileError,
  UnsupportedProofFileError,
  ProofFileUnreadableError,
} from '@porcelain/reviews/errors';
import { Effect } from 'effect';
import type { WorktreeAccess } from '../../runtime/worktree-access.ts';
import type { WorktreeAccessFailure } from '../../ports/worktree-access-failure.ts';
import type { ReadEnvironmentService } from '@porcelain/access/services';
import type {
  PublishReviewRequest,
  PublishReviewToolResponse,
} from '@porcelain/contracts/reviews';
import type { WorktreeParams } from '@porcelain/contracts/shared';
import type { ReadBinaryFilesService } from '@porcelain/files/services';
import { proofFilePaths } from '@porcelain/reviews/rules';
import type {
  ValidateReviewDraftService,
  CheckReviewDraftService,
  ResolvePublishedReviewService,
  PublishReviewService,
} from '@porcelain/reviews/services';
import type { EventPublisher } from '../../ports/event-publisher.ts';
import type { ReadReviewEvidenceUseCasePort } from '../../ports/read-review-evidence-use-case-port.ts';

export class PublishReviewUseCase {
  private readonly access: WorktreeAccess;
  private readonly validateReviewDraft: ValidateReviewDraftService;
  private readonly checkReviewDraft: CheckReviewDraftService;
  private readonly readReviewEvidence: ReadReviewEvidenceUseCasePort;
  private readonly readBinaryFiles: ReadBinaryFilesService;
  private readonly publishReview: PublishReviewService;
  private readonly readEnvironment: ReadEnvironmentService;
  private readonly resolvePublishedReview: ResolvePublishedReviewService;
  private readonly events: EventPublisher;

  constructor(
    access: WorktreeAccess,
    validateReviewDraft: ValidateReviewDraftService,
    checkReviewDraft: CheckReviewDraftService,
    readReviewEvidence: ReadReviewEvidenceUseCasePort,
    readBinaryFiles: ReadBinaryFilesService,
    publishReview: PublishReviewService,
    readEnvironment: ReadEnvironmentService,
    resolvePublishedReview: ResolvePublishedReviewService,
    events: EventPublisher,
  ) {
    this.access = access;
    this.validateReviewDraft = validateReviewDraft;
    this.checkReviewDraft = checkReviewDraft;
    this.readReviewEvidence = readReviewEvidence;
    this.readBinaryFiles = readBinaryFiles;
    this.publishReview = publishReview;
    this.readEnvironment = readEnvironment;
    this.resolvePublishedReview = resolvePublishedReview;
    this.events = events;
  }

  execute(
    input: WorktreeParams & PublishReviewRequest,
  ): Effect.Effect<
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
    const { worktreeId, ...unvalidatedDraft } = input;
    return this.access.transaction(
      worktreeId,
      () =>
        Effect.gen({ self: this }, function* () {
          const draft =
            yield* this.validateReviewDraft.execute(unvalidatedDraft);
          yield* this.checkReviewDraft.execute({ worktreeId, draft });
          const evidence = yield* this.readReviewEvidence.execute({
            worktreeId,
            layers: draft.layers,
          });
          const proofFiles = yield* this.readBinaryFiles.execute({
            worktreeId,
            paths: proofFilePaths(draft.proof),
          });
          const environment = yield* this.readEnvironment.execute();
          return { draft, evidence, proofFiles, environment };
        }),
      ({ draft, evidence, proofFiles, environment }) =>
        Effect.gen({ self: this }, function* () {
          const { review, warnings } = yield* this.publishReview.execute({
            worktreeId,
            draft,
            evidence,
            proofFiles,
          });
          return {
            review: yield* this.resolvePublishedReview.execute({
              environmentId: environment.environmentId,
              review,
              evidence,
            }),
            warnings,
          };
        }),
      () =>
        Effect.sync(() =>
          this.events.worktreeChanged({ worktreeId, change: 'review' }),
        ),
    );
  }
}
