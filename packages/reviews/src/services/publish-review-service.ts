import {
  normalizedReviewPullRequest,
  reviewPullRequestNumber,
} from '../rules/review-publication.ts';
import { ReviewCommitPinner } from '../ports/review-commit-pinner.ts';
import { ReviewPublishRefusedError } from '../errors/review-publish-refused-error.ts';
import { InvalidReviewPointerError } from '../errors/invalid-review-pointer-error.ts';
import { ProofLimits } from '../ports/proof-limits.ts';
import { Effect, Context, Layer, Clock, DateTime } from 'effect';
import { IdSource, SecretSource } from '@porcelain/kernel/ports';
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
import {
  resolveReview,
  unexplainedChanges,
  publishedLayerFingerprint,
} from '../rules/resolve-review.ts';
import { publishedLines, textLines } from '../rules/review-evidence.ts';
import {
  proofFilePaths,
  proofFileKind,
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
      | ReviewPublishRefusedError
      | InvalidReviewPointerError
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
      const pinner = yield* ReviewCommitPinner;
      const clockCapability = yield* Clock.Clock;
      const idSourceCapability = yield* IdSource;
      const secretSourceCapability = yield* SecretSource;
      const proofLimitsCapability = yield* ProofLimits;
      const operationProof = Effect.fn('PublishReviewService.proof')(function* (
        reviewId: string,
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
            const file = yield* operationProofFile(reviewId, id, asset, reads);
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
          proof: {
            checks: structuredClone(draft.checks ?? []),
            assets,
            paths: proofFilePaths(draft),
          },
          proofFiles,
        };
      });
      const operationProofFile = Effect.fn('PublishReviewService.proofFile')(
        function* (
          reviewId: string,
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
            const kept = yield* reviewsCapability.readProofFile({
              reviewId,
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
          | ReviewPublishRefusedError
          | InvalidReviewPointerError
          | ReviewConflictError
          | ProofTooLargeError
          | UnknownProofFileError
          | UnsupportedProofFileError
          | ProofFileUnreadableError
        > {
          const { draft } = input;
          const { commit } = input;
          const pullRequest = normalizedReviewPullRequest(draft.pullRequest);
          const current =
            draft.reviewId === undefined
              ? yield* reviewsCapability.findOpen({ ...commit, pullRequest })
              : yield* reviewsCapability.readRecord({
                  reviewId: draft.reviewId,
                });
          if (draft.reviewId !== undefined && current === undefined)
            return yield* new ReviewPublishRefusedError({
              message:
                'Review not found: read_review first, or omit reviewId to start a review.',
            });
          if (
            current !== undefined &&
            (current.projectId !== commit.projectId ||
              current.state !== 'open' ||
              (pullRequest !== undefined &&
                current.pullRequest !== undefined &&
                reviewPullRequestNumber(pullRequest) !==
                  reviewPullRequestNumber(current.pullRequest)) ||
              (current.pullRequest === undefined &&
                current.branch !== commit.branch))
          )
            return yield* new ReviewPublishRefusedError({
              message:
                'This review belongs to another key or is closed. Omit reviewId to publish a new review.',
            });
          if ((current?.latestRevision ?? 0) !== draft.expectedRevision)
            return yield* Effect.fail(new ReviewConflictError());
          const reviewId = current?.reviewId ?? idSourceCapability.next();
          const { proof, proofFiles } = yield* operationProof(
            reviewId,
            draft.proof,
            input.proofFiles,
          );
          const files = input.evidence.texts;
          const layers: ReviewLayer[] = [];
          for (const layer of draft.layers) {
            const steps = [];
            for (const step of layer.steps) {
              const published = publishedLines(
                files.get(step.pointer.path),
                step.pointer,
              );
              if (published === undefined)
                return yield* Effect.fail(
                  new InvalidReviewPointerError({
                    layerId: layer.id,
                    stepId: step.id,
                    ...step.pointer,
                    reason: input.evidence.missing.has(step.pointer.path)
                      ? 'missing'
                      : files.has(step.pointer.path)
                        ? 'out-of-range'
                        : 'unreadable',
                    ...(files.has(step.pointer.path)
                      ? {
                          lineCount: textLines(
                            files.get(step.pointer.path) ?? '',
                          ).length,
                        }
                      : {}),
                  }),
                );
              steps.push({ ...structuredClone(step), published });
            }
            layers.push({
              ...structuredClone(layer),
              steps,
              fingerprint: publishedLayerFingerprint(steps),
            });
          }
          const resolution = resolveReview({ layers }, input.evidence);
          const notExplained = unexplainedChanges(
            resolution.changes,
            input.evidence.texts,
            resolution.diagnostics,
            resolution.layers,
          );
          const review: Review = {
            notExplained,
            ...commit,
            reviewId,
            verdict: structuredClone(draft.verdict),
            worktreeId: input.worktreeId,
            revision: draft.expectedRevision + 1,
            publishedAt: DateTime.formatIso(
              DateTime.makeUnsafe(yield* clockCapability.currentTimeMillis),
            ),
            active: true,
            summaryHtml:
              draft.summaryHtml ?? '<!doctype html><html><body></body></html>',
            summaryToken: idSourceCapability.next(),
            summarySecret: secretSourceCapability.next(),
            ...(draft.diagram === undefined
              ? {}
              : { diagram: structuredClone(draft.diagram) }),
            layers,
            ...(proof === undefined ? {} : { proof }),
          };
          yield* pinner.pin({
            commonDirectory: commit.commonDirectory,
            reviewId,
            revision: review.revision,
            headOid: commit.headOid,
          });
          yield* reviewsCapability.save({
            ...review,
            proofFiles,
            expectedRevision: draft.expectedRevision,
            record: {
              reviewId,
              projectId: commit.projectId,
              commonDirectory: commit.commonDirectory,
              branch: commit.branch,
              pullRequest: pullRequest ?? current?.pullRequest,
              state: 'open',
              latestRevision: review.revision,
              lastSeenRevision: current?.lastSeenRevision ?? 0,
            },
          });
          return {
            review,
            warnings:
              draft.summaryHtml === undefined
                ? []
                : summaryStyleWarnings(draft.summaryHtml),
          };
        }),
      };
    }),
  );
}
