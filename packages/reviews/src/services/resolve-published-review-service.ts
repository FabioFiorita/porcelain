import { ResolvePublishedReviewOptions } from '../ports/resolve-published-review-options.ts';
import { Effect, Context, Layer } from 'effect';
import { Clock } from '@porcelain/kernel/ports';
import { instantAfter, utf8ByteLength } from '@porcelain/kernel/rules';
import {
  type ResolvePublishedReviewInput,
  type ResolvePublishedReviewResult,
} from '../models/resolve-published-review.ts';
import { SignatureSource } from '../ports/signature-source.ts';
import { changesDigest } from '../rules/review-proof.ts';
import {
  resolveReview,
  reviewIsActive,
  unexplainedChanges,
} from '../rules/resolve-review.ts';
import { summaryMessage } from '../rules/review-digests.ts';

export class ResolvePublishedReviewService extends Context.Service<
  ResolvePublishedReviewService,
  {
    readonly execute: (
      input: ResolvePublishedReviewInput,
    ) => Effect.Effect<ResolvePublishedReviewResult, never>;
  }
>()('@porcelain/reviews/ResolvePublishedReviewService') {
  static readonly layer = Layer.effect(
    ResolvePublishedReviewService,
    Effect.gen(function* () {
      const clockCapability = yield* Clock;
      const signatureSourceCapability = yield* SignatureSource;
      const optionsCapability = yield* ResolvePublishedReviewOptions;

      return {
        execute: Effect.fn('ResolvePublishedReviewService.execute')(function* (
          input: ResolvePublishedReviewInput,
        ): Effect.fn.Return<ResolvePublishedReviewResult, never> {
          return yield* Effect.sync<ResolvePublishedReviewResult>(() => {
            const { review, evidence } = input;
            const { changes, diagnostics, layers } = resolveReview(
              review,
              evidence,
            );
            const expires = instantAfter(
              clockCapability.now(),
              optionsCapability.lifetimeMs,
            );
            const signature = signatureSourceCapability.sign({
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
              proof: {
                checks: structuredClone(review.proof?.checks ?? []),
                assets: structuredClone(review.proof?.assets ?? []),
                current:
                  review.proof === undefined ||
                  review.proof.baseline?.digest ===
                    changesDigest(
                      evidence.changes,
                      review.proof.baseline?.proofPaths ?? [],
                    ),
              },
            };
          });
        }),
      };
    }),
  );
}
