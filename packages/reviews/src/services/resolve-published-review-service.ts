import { ResolvePublishedReviewOptions } from '../ports/resolve-published-review-options.ts';
import { Effect, Context, Layer, Clock, DateTime } from 'effect';
import {
  instantAfter,
  utf8ByteLength,
  sha256Hex,
} from '@porcelain/kernel/rules';
import {
  type ResolvePublishedReviewInput,
  type ResolvePublishedReviewResult,
} from '../models/resolve-published-review.ts';
import { SignatureSource } from '../ports/signature-source.ts';
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
      const clockCapability = yield* Clock.Clock;
      const signatureSourceCapability = yield* SignatureSource;
      const optionsCapability = yield* ResolvePublishedReviewOptions;

      return {
        execute: Effect.fn('ResolvePublishedReviewService.execute')(function* (
          input: ResolvePublishedReviewInput,
        ): Effect.fn.Return<ResolvePublishedReviewResult, never> {
          const observedAt = DateTime.formatIso(
            DateTime.makeUnsafe(yield* clockCapability.currentTimeMillis),
          );
          return yield* Effect.sync<ResolvePublishedReviewResult>(() => {
            const { review } = input;
            const layers = review.layers.map((layer) => ({
              ...layer,
              steps: layer.steps.map(({ published, ...step }) => ({
                ...step,
                published: [...published],
                pointer: {
                  ...step.pointer,
                  textFingerprint: sha256Hex(published.join('\n')),
                },
                location: {
                  state: 'current' as const,
                  startLine: step.pointer.startLine,
                  endLine: step.pointer.endLine,
                },
              })),
            }));
            const expires = instantAfter(
              observedAt,
              optionsCapability.lifetimeMs,
            );
            const signature = signatureSourceCapability.sign({
              secret: review.summarySecret,
              message: summaryMessage(review.summaryToken, expires),
            });
            return {
              reviewId: review.reviewId,
              headOid: review.headOid,
              base: review.base,
              baseOid: review.baseOid,
              mergeBaseOid: review.mergeBaseOid,
              verdict: review.verdict,
              environmentId: input.environmentId,
              worktreeId: review.worktreeId,
              revision: review.revision,
              publishedAt: review.publishedAt,
              active: input.headOid === review.headOid,
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
              notExplained: review.notExplained,
              proof: {
                checks: structuredClone(review.proof?.checks ?? []),
                assets: structuredClone(review.proof?.assets ?? []),
                current:
                  input.headOid === review.headOid &&
                  !(input.dirtyPaths ?? []).some(
                    (path) => !(review.proof?.paths ?? []).includes(path),
                  ),
              },
            };
          });
        }),
      };
    }),
  );
}
