import { ProofLimits } from '../ports/proof-limits.ts';
import { Effect, Context, Layer } from 'effect';
import { Clock, IdSource, SecretSource } from '@porcelain/kernel/ports';
import { ProofFileUnreadableError } from '../errors/proof-file-unreadable-error.ts';
import { ProofTooLargeError } from '../errors/proof-too-large-error.ts';
import { ReviewConflictError } from '../errors/review-conflict-error.ts';
import { UnknownProofFileError } from '../errors/unknown-proof-file-error.ts';
import { UnsupportedProofFileError } from '../errors/unsupported-proof-file-error.ts';
import {
  type PublishReviewInput,
  type PublishReviewResult,
} from '../models/publish-review.ts';
import {
  type ProofAsset,
  type ProofDraft,
  type ProofFile,
  type ProofFileDraft,
  type ProofFileReads,
  type ReviewProof,
} from '../models/review-proof.ts';
import { type Review, type ReviewLayer } from '../models/review.ts';
import { ReviewStore } from '../ports/review-store.ts';
import { publishedLayerFingerprint } from '../rules/resolve-review.ts';
import { reviewActivity } from '../rules/review-activity.ts';
import { publishedLines } from '../rules/review-evidence.ts';
import {
  changesDigest,
  proofFileKind,
  proofFilePaths,
  proofMediaType,
} from '../rules/review-proof.ts';
import { summaryStyleWarnings } from '../rules/summary-style.ts';

export class PublishReviewService extends Context.Service<
  PublishReviewService,
  {
    readonly execute: (
      input: PublishReviewInput,
    ) => Effect.Effect<
      PublishReviewResult,
      | ReviewConflictError
      | ProofTooLargeError
      | UnknownProofFileError
      | UnsupportedProofFileError
      | ProofFileUnreadableError
    >;
  }
>()('@porcelain/reviews/PublishReviewService') {
  static readonly layer = Layer.effect(
    PublishReviewService,
    Effect.gen(function* () {
      const reviewsCapability = yield* ReviewStore;
      const clockCapability = yield* Clock;
      const idSourceCapability = yield* IdSource;
      const secretSourceCapability = yield* SecretSource;
      const proofLimitsCapability = yield* ProofLimits;
      const operationProof = Effect.fn('PublishReviewService.proof')(function* (
        worktreeId: string,
        draft: ProofDraft | undefined,
        reads: ProofFileReads | undefined,
      ): Effect.fn.Return<
        { proof: ReviewProof | undefined; proofFiles: ProofFile[] },
        | UnknownProofFileError
        | UnsupportedProofFileError
        | ProofTooLargeError
        | ProofFileUnreadableError
      > {
        if (draft === undefined) return { proof: undefined, proofFiles: [] };
        const proofFiles: ProofFile[] = [];
        const assets = yield* Effect.forEach(draft.assets ?? [], (asset) =>
          Effect.gen(function* () {
            const id = idSourceCapability.next();
            if (asset.kind === 'link') return { ...structuredClone(asset), id };
            const file = yield* operationProofFile(
              worktreeId,
              id,
              asset,
              reads,
            );
            proofFiles.push(file);
            return operationFileAsset(asset, file);
          }),
        );
        const total = proofFiles.reduce(
          (sum, file) => sum + file.bytes.byteLength,
          0,
        );
        if (total > proofLimitsCapability.totalBytes)
          return yield* Effect.fail(new ProofTooLargeError());
        return {
          proof: { checks: structuredClone(draft.checks ?? []), assets },
          proofFiles,
        };
      });
      const operationProofFile = Effect.fn('PublishReviewService.proofFile')(
        function* (
          worktreeId: string,
          id: string,
          asset: ProofFileDraft,
          reads: ProofFileReads | undefined,
        ): Effect.fn.Return<
          ProofFile,
          | UnknownProofFileError
          | UnsupportedProofFileError
          | ProofTooLargeError
          | ProofFileUnreadableError
        > {
          if (asset.proofId !== undefined) {
            const kept = reviewsCapability.readProofFile({
              worktreeId,
              proofId: asset.proofId,
            });
            if (kept === undefined)
              return yield* Effect.fail(new UnknownProofFileError());
            if (proofFileKind(kept.mediaType) !== asset.kind)
              return yield* Effect.fail(new UnsupportedProofFileError());
            return { id, mediaType: kept.mediaType, bytes: kept.bytes };
          }
          const path = asset.path ?? '';
          if (reads?.tooLarge.includes(path))
            return yield* Effect.fail(new ProofTooLargeError());
          const bytes = reads?.files.get(path);
          if (bytes === undefined)
            return yield* Effect.fail(new ProofFileUnreadableError());
          const mediaType = proofMediaType(
            bytes.subarray(0, proofLimitsCapability.signatureBytes),
          );
          if (
            mediaType === undefined ||
            proofFileKind(mediaType) !== asset.kind
          )
            return yield* Effect.fail(new UnsupportedProofFileError());
          return { id, mediaType, bytes };
        },
      );
      function operationFileAsset(
        asset: ProofFileDraft,
        file: ProofFile,
      ): ProofAsset {
        return {
          id: file.id,
          kind: proofFileKind(file.mediaType),
          title: asset.title,
          mediaType: file.mediaType,
          byteLength: file.bytes.byteLength,
          ...(asset.layerId === undefined ? {} : { layerId: asset.layerId }),
          ...(asset.stepId === undefined ? {} : { stepId: asset.stepId }),
        };
      }
      return {
        execute: Effect.fn('PublishReviewService.execute')(function* (
          input: PublishReviewInput,
        ): Effect.fn.Return<
          PublishReviewResult,
          | ReviewConflictError
          | ProofTooLargeError
          | UnknownProofFileError
          | UnsupportedProofFileError
          | ProofFileUnreadableError
        > {
          const { draft } = input;
          const current = reviewsCapability.read({
            worktreeId: input.worktreeId,
          });
          if ((current?.revision ?? 0) !== draft.expectedRevision)
            return yield* Effect.fail(new ReviewConflictError());
          const { proof, proofFiles } = yield* operationProof(
            input.worktreeId,
            draft.proof,
            input.proofFiles,
          );
          const proofPaths = proofFilePaths(draft.proof);
          const proven =
            proof === undefined
              ? undefined
              : {
                  ...proof,
                  baseline: {
                    digest: changesDigest(input.evidence.changes, proofPaths),
                    proofPaths,
                  },
                };
          const files = input.evidence.texts;
          const layers = draft.layers.map((layer): ReviewLayer => {
            const steps = layer.steps.map((step) => ({
              ...structuredClone(step),
              published: publishedLines(
                files.get(step.pointer.path),
                step.pointer,
              ),
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
            publishedAt: clockCapability.now(),
            active: reviewActivity({ layers }, input.evidence),
            summaryHtml: draft.summaryHtml,
            summaryToken: idSourceCapability.next(),
            summarySecret: secretSourceCapability.next(),
            ...(draft.diagram === undefined
              ? {}
              : { diagram: structuredClone(draft.diagram) }),
            layers,
            ...(proven === undefined ? {} : { proof: proven }),
          };
          reviewsCapability.save({ ...review, proofFiles });
          return { review, warnings: summaryStyleWarnings(draft.summaryHtml) };
        }),
      };
    }),
  );
}
