import type { Clock } from '@porcelain/kernel/ports';
import { instantAfter, utf8ByteLength } from '@porcelain/kernel/rules';
import type {
  GeneratePublishedReviewInput,
  GeneratePublishedReviewResult,
} from '../models/generate-published-review.ts';
import type { SummaryLinkLimits } from '../models/resolved-review.ts';
import type { SignatureSource } from '../ports/signature-source.ts';
import {
  resolveReview,
  reviewIsActive,
  unexplainedChanges,
} from '../rules/resolve-review.ts';
import { summaryMessage, summaryUrl } from '../rules/review-digests.ts';

export class GeneratePublishedReviewService {
  private readonly clock: Clock;
  private readonly signatureSource: SignatureSource;
  private readonly limits: SummaryLinkLimits;

  constructor(
    clock: Clock,
    signatureSource: SignatureSource,
    limits: SummaryLinkLimits,
  ) {
    this.clock = clock;
    this.signatureSource = signatureSource;
    this.limits = limits;
  }

  execute(input: GeneratePublishedReviewInput): GeneratePublishedReviewResult {
    const { review, evidence } = input;
    const { changes, diagnostics, layers } = resolveReview(review, evidence);
    const expires = instantAfter(this.clock.now(), this.limits.lifetimeMs);
    const signature = this.signatureSource.sign({
      secret: review.summarySecret,
      message: summaryMessage(review.summaryToken, expires),
    });
    return {
      environmentId: input.environmentId,
      worktreeId: review.worktreeId,
      revision: review.revision,
      publishedAt: review.publishedAt,
      active: reviewIsActive(layers),
      diagnostics: 'current',
      summary: {
        url: summaryUrl(review.summaryToken, expires, signature),
        byteLength: utf8ByteLength(review.summaryHtml),
      },
      ...(review.diagram === undefined
        ? {}
        : { diagram: structuredClone(review.diagram) }),
      layers,
      notExplained: unexplainedChanges(
        changes,
        evidence.texts,
        diagnostics,
        layers,
      ),
    };
  }
}
