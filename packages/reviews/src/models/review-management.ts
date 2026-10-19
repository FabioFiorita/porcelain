import { Schema } from 'effect';
import type {
  Review,
  ReviewRecord,
  ReviewCommit,
  ReviewVerdict,
} from './review.ts';
import type { ReviewedFileMark, ReviewedLayerMark } from './reviewed-mark.ts';
export type ReadReviewInput = {
  reviewId: string;
  revision?: number | undefined;
};
export type ReadReviewResult = {
  record: ReviewRecord;
  revision: Review;
  revisions: readonly Review[];
};
const setReviewMarkSchema = Schema.Union([
  Schema.Struct({
    kind: Schema.Literal('file'),
    revision: Schema.Number,
    path: Schema.String,
    headBlobOid: Schema.String,
  }),
  Schema.Struct({
    kind: Schema.Literal('decision'),
    revision: Schema.Number,
    layerId: Schema.String,
    fingerprint: Schema.String,
  }),
]);
const removeReviewMarkSchema = Schema.Union([
  Schema.Struct({
    kind: Schema.Literal('file'),
    path: Schema.String,
    headBlobOid: Schema.String,
  }),
  Schema.Struct({
    kind: Schema.Literal('decision'),
    layerId: Schema.String,
    fingerprint: Schema.String,
  }),
]);
export type SetReviewMarkInput = {
  reviewId: string;
} & typeof setReviewMarkSchema.Type;
export type RemoveReviewMarkInput = {
  reviewId: string;
} & typeof removeReviewMarkSchema.Type;
export type ReviewMarks = {
  files: readonly ReviewedFileMark[];
  decisions: readonly ReviewedLayerMark[];
};
export type ReviewLinkHosts = {
  hubOrigin: string;
  localHost: string;
  localPort: number;
  cloudflare?: string | undefined;
  tailnet?: string | undefined;
  tailnetPort?: number | undefined;
};
export type ReviewLinks = {
  web: string;
  app: string;
  revision: { web: string; app: string };
  decisions: readonly { layerId: string; web: string; app: string }[];
};

export type ReadReviewSelection =
  | ReadReviewInput
  | { worktreeId: string; revision?: number | undefined };

export type ReviewPublicationInput = {
  status:
    | { kind: 'ready'; commit: ReviewCommit }
    | { kind: 'unborn' | 'detached' | 'base-unavailable' };
  dirtyPaths: readonly string[];
  proofPaths: readonly string[];
  verdict: ReviewVerdict;
  origin: string | undefined;
  pullRequest: string | undefined;
};
