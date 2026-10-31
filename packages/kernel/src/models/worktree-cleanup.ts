import { Schema } from 'effect';
const worktreeCleanupOptionsSchema = Schema.Struct({
  deleteWorktree: Schema.Boolean,
  deleteLocalBranch: Schema.Boolean,
  deleteRemoteBranch: Schema.Boolean,
});
export const worktreeCleanupPlanSchema = Schema.Struct({
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
export const worktreeCleanupRequestSchema = Schema.Struct({
  options: worktreeCleanupOptionsSchema,
  confirmation: Schema.optional(
    Schema.Struct({
      plan: worktreeCleanupPlanSchema,
      discardChanges: Schema.Boolean,
    }),
  ),
});
export type WorktreeCleanupPlan = typeof worktreeCleanupPlanSchema.Type;
export type WorktreeCleanupRequest = typeof worktreeCleanupRequestSchema.Type;
