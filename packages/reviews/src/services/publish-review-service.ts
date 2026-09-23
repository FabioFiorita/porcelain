import { ReviewConflictError } from '../errors/review-conflict-error.ts';
import type {
  PublishReviewInput,
  PublishReviewResult,
} from '../models/review-operations.ts';
import type { Review, ReviewLayer } from '../models/review.ts';
import type { Clock } from '../ports/clock.ts';
import type { IdSource } from '../ports/id-source.ts';
import type { ReviewStore } from '../ports/review-store.ts';
import type { SecretSource } from '../ports/secret-source.ts';
import { publishedLayerFingerprint } from '../rules/resolve-review.ts';
import { assertReviewDraft } from '../rules/review-draft.ts';
import { publishedLines } from '../rules/review-evidence.ts';
import { summaryStyleWarnings } from '../rules/summary-style.ts';

export class PublishReviewService {
  private readonly reviewStore: ReviewStore;
  private readonly clock: Clock;
  private readonly idSource: IdSource;
  private readonly secretSource: SecretSource;

  constructor(
    reviewStore: ReviewStore,
    clock: Clock,
    idSource: IdSource,
    secretSource: SecretSource,
  ) {
    this.reviewStore = reviewStore;
    this.clock = clock;
    this.idSource = idSource;
    this.secretSource = secretSource;
  }

  execute(input: PublishReviewInput): PublishReviewResult {
    const { draft, files } = input;
    assertReviewDraft(draft);
    const current = this.reviewStore.read(input.worktreeId);
    if ((current?.revision ?? 0) !== draft.expectedRevision)
      throw new ReviewConflictError();
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
    this.reviewStore.save(review);
    return { review, warnings: summaryStyleWarnings(draft.summaryHtml) };
  }
}
