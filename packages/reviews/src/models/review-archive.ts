import { Schema } from 'effect';
const reviewArchiveOptionsSchema = Schema.Struct({
  deleteWorktree: Schema.Boolean,
  deleteLocalBranch: Schema.Boolean,
  deleteRemoteBranch: Schema.Boolean,
});
const reviewArchivePlanSchema = Schema.Struct({
  worktreePath: Schema.optional(Schema.String),
  detachWorktreePath: Schema.optional(Schema.String),
  localBranch: Schema.optional(Schema.String),
  remoteBranch: Schema.optional(Schema.String),
  remoteBranchNote: Schema.optional(Schema.String),
  mainCheckout: Schema.Boolean,
  dirty: Schema.Boolean,
  unpushed: Schema.Boolean,
  fingerprint: Schema.String,
});
export type ReviewArchivePlan = typeof reviewArchivePlanSchema.Type;
export const archiveReviewRequestSchema = Schema.Struct({
  options: reviewArchiveOptionsSchema,
  confirmation: Schema.optional(
    Schema.Struct({
      plan: reviewArchivePlanSchema,
      discardChanges: Schema.Boolean,
    }),
  ),
});
export type ArchiveReviewRequest = typeof archiveReviewRequestSchema.Type;
export const archiveReviewResponseSchema = Schema.Struct({
  archived: Schema.Boolean,
  plan: reviewArchivePlanSchema,
});
export type ReviewArchiveTarget = ArchiveReviewRequest & {
  commonDirectory: string;
  repositoryIdentity: string;
  worktreePath: string;
  branch: string;
  mergedHead?: string | undefined;
};
