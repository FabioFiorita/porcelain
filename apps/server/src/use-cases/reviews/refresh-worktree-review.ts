import type { GitIoFailure } from '../../ports/git-io-failure.ts';
import type { IncompleteDiffReadError } from '@porcelain/changes/errors';
import { Effect } from 'effect';
import type { WorktreeAccess } from '../../runtime/worktree-access.ts';
import type { WorktreeAccessFailure } from '../../ports/worktree-access-failure.ts';
import type { WorktreeKey } from '@porcelain/kernel/models';
import type {
  ReadPublishedReviewService,
  RecordReviewActivityService,
} from '@porcelain/reviews/services';
import type { EventPublisher } from '../../ports/event-publisher.ts';
import type { ReadReviewEvidenceUseCasePort } from '../../ports/read-review-evidence-use-case-port.ts';

export class RefreshWorktreeReviewUseCase {
  private readonly access: WorktreeAccess;
  private readonly readPublishedReview: ReadPublishedReviewService;
  private readonly readReviewEvidence: ReadReviewEvidenceUseCasePort;
  private readonly recordReviewActivity: RecordReviewActivityService;
  private readonly events: EventPublisher;

  constructor(
    access: WorktreeAccess,
    readPublishedReview: ReadPublishedReviewService,
    readReviewEvidence: ReadReviewEvidenceUseCasePort,
    recordReviewActivity: RecordReviewActivityService,
    events: EventPublisher,
  ) {
    this.access = access;
    this.readPublishedReview = readPublishedReview;
    this.readReviewEvidence = readReviewEvidence;
    this.recordReviewActivity = recordReviewActivity;
    this.events = events;
  }

  execute(
    input: WorktreeKey,
  ): Effect.Effect<
    void,
    WorktreeAccessFailure | GitIoFailure | IncompleteDiffReadError
  > {
    const { worktreeId } = input;
    return this.access
      .transaction(
        worktreeId,
        () =>
          Effect.gen({ self: this }, function* () {
            const published = yield* this.readPublishedReview.execute({
              worktreeId,
            });
            if (published.kind === 'none') return undefined;
            const evidence = yield* this.readReviewEvidence.execute({
              worktreeId,
              layers: published.review.layers,
            });
            return { review: published.review, evidence };
          }),
        (prepared) =>
          prepared
            ? this.recordReviewActivity.execute(prepared)
            : Effect.succeed({ changed: false }),
        ({ changed }) =>
          Effect.sync(() => {
            if (changed)
              this.events.worktreeChanged({ worktreeId, change: 'review' });
          }),
      )
      .pipe(Effect.asVoid);
  }
}
