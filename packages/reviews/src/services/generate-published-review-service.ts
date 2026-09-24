import type { Clock } from '@porcelain/kernel/ports';
import type {
  GeneratePublishedReviewInput,
  GeneratePublishedReviewResult,
} from '../models/generate-published-review.ts';
import type { SummaryLinkLimits } from '../models/resolved-review.ts';
import type { InstantSource } from '../ports/instant-source.ts';
import type { SignatureSource } from '../ports/signature-source.ts';
import {
  resolveLayer,
  reviewIsActive,
  unexplainedChanges,
} from '../rules/resolve-review.ts';
import { reviewDiagnostics } from '../rules/review-diagnostics.ts';
import {
  summaryMessage,
  summaryUrl,
  utf8ByteLength,
} from '../rules/review-digests.ts';
import {
  reviewChanges,
  reviewFiles,
  reviewPatches,
} from '../rules/review-evidence.ts';

export class GeneratePublishedReviewService {
  private readonly clock: Clock;
  private readonly instantSource: InstantSource;
  private readonly signatureSource: SignatureSource;
  private readonly limits: SummaryLinkLimits;

  constructor(
    clock: Clock,
    instantSource: InstantSource,
    signatureSource: SignatureSource,
    limits: SummaryLinkLimits,
  ) {
    this.clock = clock;
    this.instantSource = instantSource;
    this.signatureSource = signatureSource;
    this.limits = limits;
  }

  execute(input: GeneratePublishedReviewInput): GeneratePublishedReviewResult {
    const { review } = input;
    const files = reviewFiles(input.texts);
    const changes = reviewChanges(input.changes);
    const diagnostics = reviewDiagnostics(
      changes,
      files,
      reviewPatches(input.diffs),
    );
    const layers = review.layers.map((layer) =>
      resolveLayer(layer, files, diagnostics.changed),
    );
    const expires = this.instantSource.after({
      instant: this.clock.now(),
      milliseconds: this.limits.lifetimeMs,
    });
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
      notExplained: unexplainedChanges(changes, files, diagnostics, layers),
    };
  }
}
