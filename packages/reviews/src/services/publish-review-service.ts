import { InvalidLineRangeError } from '@porcelain/kernel/errors';
import type { Clock, IdSource, SecretSource } from '@porcelain/kernel/ports';
import { BoxLaneOutOfRangeError } from '../errors/box-lane-out-of-range-error.ts';
import { DuplicateLayerIdError } from '../errors/duplicate-layer-id-error.ts';
import { DuplicateStepIdError } from '../errors/duplicate-step-id-error.ts';
import { ProofFileUnreadableError } from '../errors/proof-file-unreadable-error.ts';
import { ProofTooLargeError } from '../errors/proof-too-large-error.ts';
import { ReviewConflictError } from '../errors/review-conflict-error.ts';
import { StepLaneOutOfRangeError } from '../errors/step-lane-out-of-range-error.ts';
import { UnknownArrowBoxError } from '../errors/unknown-arrow-box-error.ts';
import { UnknownArrowStepError } from '../errors/unknown-arrow-step-error.ts';
import { UnknownProofTargetError } from '../errors/unknown-proof-target-error.ts';
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
import type {
  Review,
  ReviewDraftProblem,
  ReviewLayer,
} from '../models/review.ts';
import type { ReviewStore } from '../ports/review-store.ts';
import { publishedLayerFingerprint } from '../rules/resolve-review.ts';
import { reviewDraftProblem } from '../rules/review-draft.ts';
import { reviewActivity } from '../rules/review-activity.ts';
import { publishedLines } from '../rules/review-evidence.ts';
import { proofFileKind, proofMediaType } from '../rules/review-proof.ts';
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

  execute(input: PublishReviewInput): PublishReviewResult {
    const { draft } = input;
    const problem = reviewDraftProblem(draft);
    if (problem !== undefined) throw this.invalid(problem);
    const current = this.reviews.read({ worktreeId: input.worktreeId });
    if ((current?.revision ?? 0) !== draft.expectedRevision)
      throw new ReviewConflictError();
    const { proof, proofFiles } = this.proof(draft.proof, input.proofFiles);
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
      ...(proof === undefined ? {} : { proof }),
    };
    this.reviews.save({ ...review, proofFiles });
    return { review, warnings: summaryStyleWarnings(draft.summaryHtml) };
  }

  private proof(
    draft: ProofDraft | undefined,
    reads: ProofFileReads | undefined,
  ): { proof: ReviewProof | undefined; proofFiles: ProofFile[] } {
    if (draft === undefined) return { proof: undefined, proofFiles: [] };
    const proofFiles: ProofFile[] = [];
    const assets = (draft.assets ?? []).map((asset) => {
      const id = this.idSource.next();
      if (asset.kind === 'link') return { ...structuredClone(asset), id };
      const file = this.proofFile(id, asset, reads);
      proofFiles.push(file);
      return this.fileAsset(asset, file);
    });
    const total = proofFiles.reduce(
      (sum, file) => sum + file.bytes.byteLength,
      0,
    );
    if (total > this.proofLimits.totalBytes) throw new ProofTooLargeError();
    return {
      proof: { checks: structuredClone(draft.checks ?? []), assets },
      proofFiles,
    };
  }

  private proofFile(
    id: string,
    asset: ProofFileDraft,
    reads: ProofFileReads | undefined,
  ): ProofFile {
    if (reads?.tooLarge.includes(asset.path)) throw new ProofTooLargeError();
    const bytes = reads?.files.get(asset.path);
    if (bytes === undefined) throw new ProofFileUnreadableError();
    const mediaType = proofMediaType(
      bytes.subarray(0, this.proofLimits.signatureBytes),
    );
    if (mediaType === undefined || proofFileKind(mediaType) !== asset.kind)
      throw new UnsupportedProofFileError();
    return { id, mediaType, bytes };
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

  private invalid(problem: ReviewDraftProblem): Error {
    switch (problem.kind) {
      case 'duplicate-layer-id':
        return new DuplicateLayerIdError();
      case 'duplicate-step-id':
        return new DuplicateStepIdError();
      case 'reversed-pointer':
        return new InvalidLineRangeError();
      case 'step-lane-out-of-range':
        return new StepLaneOutOfRangeError();
      case 'unknown-arrow-step':
        return new UnknownArrowStepError();
      case 'box-lane-out-of-range':
        return new BoxLaneOutOfRangeError();
      case 'unknown-arrow-box':
        return new UnknownArrowBoxError();
      case 'unknown-proof-target':
        return new UnknownProofTargetError();
    }
  }
}
