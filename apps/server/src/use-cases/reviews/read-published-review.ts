import type { MissingEnvironmentIdentityError } from '@porcelain/access/errors';
import type { GitIoFailure } from '../../ports/git-io-failure.ts';
import type { IncompleteDiffReadError } from '@porcelain/changes/errors';
import { Effect } from 'effect';
import type { WorktreeAccess } from '../../runtime/worktree-access.ts';
import type { WorktreeAccessFailure } from '../../ports/worktree-access-failure.ts';
import type { ReadEnvironmentService } from '@porcelain/access/services';
import type { ReadPublishedReviewResponse } from '@porcelain/contracts/reviews';
import type { WorktreeParams } from '@porcelain/contracts/shared';
import type {
  ResolvePublishedReviewService,
  ReadPublishedReviewService,
} from '@porcelain/reviews/services';
import type { ReadReviewEvidenceUseCasePort } from '../../ports/read-review-evidence-use-case-port.ts';

export class ReadPublishedReviewUseCase {
  private readonly access: WorktreeAccess;
  private readonly readPublishedReview: ReadPublishedReviewService;
  private readonly readReviewEvidence: ReadReviewEvidenceUseCasePort;
  private readonly readEnvironment: ReadEnvironmentService;
  private readonly resolvePublishedReview: ResolvePublishedReviewService;

  constructor(
    access: WorktreeAccess,
    readPublishedReview: ReadPublishedReviewService,
    readReviewEvidence: ReadReviewEvidenceUseCasePort,
    readEnvironment: ReadEnvironmentService,
    resolvePublishedReview: ResolvePublishedReviewService,
  ) {
    this.access = access;
    this.readPublishedReview = readPublishedReview;
    this.readReviewEvidence = readReviewEvidence;
    this.readEnvironment = readEnvironment;
    this.resolvePublishedReview = resolvePublishedReview;
  }

  execute(
    input: WorktreeParams,
  ): Effect.Effect<
    ReadPublishedReviewResponse,
    | MissingEnvironmentIdentityError
    | WorktreeAccessFailure
    | GitIoFailure
    | IncompleteDiffReadError
  > {
    return Effect.gen({ self: this }, function* () {
      const { worktreeId } = input;
      return yield* this.access.reviews(worktreeId, 'read', () =>
        Effect.gen({ self: this }, function* () {
          const published = yield* this.readPublishedReview.execute({
            worktreeId,
          });
          if (published.kind === 'none') return { review: undefined };
          const evidence = yield* this.readReviewEvidence.execute({
            worktreeId,
            layers: published.review.layers,
          });
          const resolved = yield* this.resolvePublishedReview.execute({
            environmentId: (yield* this.readEnvironment.execute())
              .environmentId,
            review: published.review,
            evidence,
          });
          return { review: resolved };
        }),
      );
    });
  }
}
