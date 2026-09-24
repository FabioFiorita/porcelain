import { InvalidLineRangeError } from '@porcelain/kernel/errors';
import type { Clock, IdSource } from '@porcelain/kernel/ports';
import { BoxLaneOutOfRangeError } from '../errors/box-lane-out-of-range-error.ts';
import { DuplicateLayerIdError } from '../errors/duplicate-layer-id-error.ts';
import { DuplicateStepIdError } from '../errors/duplicate-step-id-error.ts';
import { ReviewConflictError } from '../errors/review-conflict-error.ts';
import { StepLaneOutOfRangeError } from '../errors/step-lane-out-of-range-error.ts';
import { UnknownArrowBoxError } from '../errors/unknown-arrow-box-error.ts';
import { UnknownArrowStepError } from '../errors/unknown-arrow-step-error.ts';
import type {
  PublishReviewInput,
  PublishReviewResult,
} from '../models/publish-review.ts';
import type {
  Review,
  ReviewDraftProblem,
  ReviewLayer,
} from '../models/review.ts';
import type { ReviewStore } from '../ports/review-store.ts';
import type { SecretSource } from '../ports/secret-source.ts';
import { publishedLayerFingerprint } from '../rules/resolve-review.ts';
import { reviewDraftProblem } from '../rules/review-draft.ts';
import { publishedLines, reviewFiles } from '../rules/review-evidence.ts';
import { summaryStyleWarnings } from '../rules/summary-style.ts';

export class PublishReviewService {
  private readonly reviews: ReviewStore;
  private readonly clock: Clock;
  private readonly idSource: IdSource;
  private readonly secretSource: SecretSource;

  constructor(
    reviews: ReviewStore,
    clock: Clock,
    idSource: IdSource,
    secretSource: SecretSource,
  ) {
    this.reviews = reviews;
    this.clock = clock;
    this.idSource = idSource;
    this.secretSource = secretSource;
  }

  execute(input: PublishReviewInput): PublishReviewResult {
    const { draft } = input;
    const problem = reviewDraftProblem(draft);
    if (problem !== undefined) throw this.invalid(problem);
    const current = this.reviews.read({ worktreeId: input.worktreeId });
    if ((current?.revision ?? 0) !== draft.expectedRevision)
      throw new ReviewConflictError();
    const files = reviewFiles(input.texts);
    const layers = draft.layers.map((layer): ReviewLayer => {
      const steps = layer.steps.map((step) => ({
        ...structuredClone(step),
        published: publishedLines(files.get(step.pointer.path), step.pointer),
      }));
      return {
        ...structuredClone(layer),
        steps,
        fingerprint: publishedLayerFingerprint(steps),
      };
    });
    const review: Review = {
      worktreeId: input.worktreeId,
      revision: draft.expectedRevision + 1,
      publishedAt: this.clock.now(),
      active: true,
      summaryHtml: draft.summaryHtml,
      summaryToken: this.idSource.next(),
      summarySecret: this.secretSource.next(),
      ...(draft.diagram === undefined
        ? {}
        : { diagram: structuredClone(draft.diagram) }),
      layers,
    };
    this.reviews.save(review);
    return { review, warnings: summaryStyleWarnings(draft.summaryHtml) };
  }

  private invalid(problem: ReviewDraftProblem): Error {
    switch (problem) {
      case 'duplicate-layer-id':
        return new DuplicateLayerIdError();
      case 'duplicate-step-id':
        return new DuplicateStepIdError();
      case 'reversed-pointer':
        return new InvalidLineRangeError();
      case 'step-lane-out-of-range':
        return new StepLaneOutOfRangeError();
      case 'unknown-arrow-step':
        return new UnknownArrowStepError();
      case 'box-lane-out-of-range':
        return new BoxLaneOutOfRangeError();
      case 'unknown-arrow-box':
        return new UnknownArrowBoxError();
    }
  }
}
