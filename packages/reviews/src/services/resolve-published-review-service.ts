import type {
  ResolvePublishedReviewInput,
  ResolvePublishedReviewResult,
} from '../models/review-operations.ts';
import type { Clock } from '../ports/clock.ts';
import {
  resolveLayer,
  reviewIsActive,
  unexplainedChanges,
} from '../rules/resolve-review.ts';
import { reviewDiagnostics } from '../rules/review-diagnostics.ts';
import {
  summaryExpiry,
  summarySignature,
  utf8ByteLength,
} from '../rules/review-digests.ts';
import { reviewChanges } from '../rules/review-evidence.ts';

export class ResolvePublishedReviewService {
  private readonly clock: Clock;

  constructor(clock: Clock) {
    this.clock = clock;
  }

  execute(input: ResolvePublishedReviewInput): ResolvePublishedReviewResult {
    const { review, files } = input;
    const evidence =
      input.changes === undefined || input.patches === undefined
        ? undefined
        : {
            changes: reviewChanges(input.changes),
            patches: input.patches,
          };
    const diagnostics =
      evidence && reviewDiagnostics(evidence.changes, files, evidence.patches);
    const layers = review.layers.map((layer) =>
      resolveLayer(layer, files, diagnostics?.changed),
    );
    const expires = summaryExpiry(this.clock.now());
    return {
      environmentId: input.environmentId,
      worktreeId: review.worktreeId,
      revision: review.revision,
      publishedAt: review.publishedAt,
      active: reviewIsActive(layers),
      diagnostics: diagnostics === undefined ? 'unavailable' : 'current',
      summary: {
        token: review.summaryToken,
        expires,
        signature: summarySignature(
          review.summarySecret,
          review.summaryToken,
          expires,
        ),
        byteLength: utf8ByteLength(review.summaryHtml),
      },
      ...(review.diagram === undefined
        ? {}
        : { diagram: structuredClone(review.diagram) }),
      layers,
      notExplained:
        evidence && diagnostics
          ? unexplainedChanges(evidence.changes, files, diagnostics, layers)
          : [],
    };
  }
}
