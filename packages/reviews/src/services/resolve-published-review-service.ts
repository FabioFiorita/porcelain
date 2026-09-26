import type { Clock } from '@porcelain/kernel/ports';
import { instantAfter, utf8ByteLength } from '@porcelain/kernel/rules';
import type {
  ResolvePublishedReviewInput,
  ResolvePublishedReviewOptions,
  ResolvePublishedReviewResult,
} from '../models/resolve-published-review.ts';

import type { SignatureSource } from '../ports/signature-source.ts';
import {
  resolveReview,
  reviewIsActive,
  unexplainedChanges,
} from '../rules/resolve-review.ts';
import { summaryMessage } from '../rules/review-digests.ts';

export class ResolvePublishedReviewService {
  private readonly clock: Clock;
  private readonly signatureSource: SignatureSource;
  private readonly options: ResolvePublishedReviewOptions;

  constructor(
    clock: Clock,
    signatureSource: SignatureSource,
    options: ResolvePublishedReviewOptions,
  ) {
    this.clock = clock;
    this.signatureSource = signatureSource;
    this.options = options;
  }

  execute(input: ResolvePublishedReviewInput): ResolvePublishedReviewResult {
    const { review, evidence } = input;
    const { changes, diagnostics, layers } = resolveReview(review, evidence);
    const expires = instantAfter(this.clock.now(), this.options.lifetimeMs);
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
        token: review.summaryToken,
        expires,
        signature,
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
