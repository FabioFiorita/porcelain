import { Effect } from 'effect';
import type { Clock, IdSource, SecretSource } from '@porcelain/kernel/ports';
import { ProofFileUnreadableError } from '../errors/proof-file-unreadable-error.ts';
import { ProofTooLargeError } from '../errors/proof-too-large-error.ts';
import { ReviewConflictError } from '../errors/review-conflict-error.ts';
import { UnknownProofFileError } from '../errors/unknown-proof-file-error.ts';
import { UnsupportedProofFileError } from '../errors/unsupported-proof-file-error.ts';
import type {
  PublishReviewInput,
  PublishReviewResult,
} from '../models/publish-review.ts';
import type {
  ProofAsset,
  ProofDraft,
  ProofFile,
  ProofFileDraft,
  ProofFileReads,
  ProofLimits,
  ReviewProof,
} from '../models/review-proof.ts';
import type { Review, ReviewLayer } from '../models/review.ts';
import type { ReviewStore } from '../ports/review-store.ts';
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

export class PublishReviewService {
  private readonly reviews: ReviewStore;
  private readonly clock: Clock;
  private readonly idSource: IdSource;
  private readonly secretSource: SecretSource;
  private readonly proofLimits: ProofLimits;

  constructor(
    reviews: ReviewStore,
    clock: Clock,
    idSource: IdSource,
    secretSource: SecretSource,
    proofLimits: ProofLimits,
  ) {
    this.reviews = reviews;
    this.clock = clock;
    this.idSource = idSource;
    this.secretSource = secretSource;
    this.proofLimits = proofLimits;
  }

  execute(
    input: PublishReviewInput,
  ): Effect.Effect<
    PublishReviewResult,
    | ReviewConflictError
    | ProofTooLargeError
    | UnknownProofFileError
    | UnsupportedProofFileError
    | ProofFileUnreadableError
  > {
    return Effect.gen({ self: this }, function* () {
      const { draft } = input;
      const current = this.reviews.read({ worktreeId: input.worktreeId });
      if ((current?.revision ?? 0) !== draft.expectedRevision)
        return yield* Effect.fail(new ReviewConflictError());
      const { proof, proofFiles } = yield* this.proof(
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
        active: reviewActivity({ layers }, input.evidence),
        summaryHtml: draft.summaryHtml,
        summaryToken: this.idSource.next(),
        summarySecret: this.secretSource.next(),
        ...(draft.diagram === undefined
          ? {}
          : { diagram: structuredClone(draft.diagram) }),
        layers,
        ...(proven === undefined ? {} : { proof: proven }),
      };
      this.reviews.save({ ...review, proofFiles });
      return { review, warnings: summaryStyleWarnings(draft.summaryHtml) };
    });
  }

  private proof(
    worktreeId: string,
    draft: ProofDraft | undefined,
    reads: ProofFileReads | undefined,
  ): Effect.Effect<
    { proof: ReviewProof | undefined; proofFiles: ProofFile[] },
    | UnknownProofFileError
    | UnsupportedProofFileError
    | ProofTooLargeError
    | ProofFileUnreadableError
  > {
    return Effect.gen({ self: this }, function* () {
      if (draft === undefined) return { proof: undefined, proofFiles: [] };
      const proofFiles: ProofFile[] = [];
      const assets = yield* Effect.forEach(draft.assets ?? [], (asset) =>
        Effect.gen({ self: this }, function* () {
          const id = this.idSource.next();
          if (asset.kind === 'link') return { ...structuredClone(asset), id };
          const file = yield* this.proofFile(worktreeId, id, asset, reads);
          proofFiles.push(file);
          return this.fileAsset(asset, file);
        }),
      );
      const total = proofFiles.reduce(
        (sum, file) => sum + file.bytes.byteLength,
        0,
      );
      if (total > this.proofLimits.totalBytes)
        return yield* Effect.fail(new ProofTooLargeError());
      return {
        proof: { checks: structuredClone(draft.checks ?? []), assets },
        proofFiles,
      };
    });
  }

  private proofFile(
    worktreeId: string,
    id: string,
    asset: ProofFileDraft,
    reads: ProofFileReads | undefined,
  ): Effect.Effect<
    ProofFile,
    | UnknownProofFileError
    | UnsupportedProofFileError
    | ProofTooLargeError
    | ProofFileUnreadableError
  > {
    return Effect.gen({ self: this }, function* () {
      if (asset.proofId !== undefined) {
        const kept = this.reviews.readProofFile({
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
        bytes.subarray(0, this.proofLimits.signatureBytes),
      );
      if (mediaType === undefined || proofFileKind(mediaType) !== asset.kind)
        return yield* Effect.fail(new UnsupportedProofFileError());
      return { id, mediaType, bytes };
    });
  }

  private fileAsset(asset: ProofFileDraft, file: ProofFile): ProofAsset {
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
}
