import { Schema } from 'effect';
import {
  worktreeCleanupPlanSchema,
  worktreeCleanupRequestSchema,
} from '@porcelain/kernel/models';
export const deleteWorktreeRequestSchema = worktreeCleanupRequestSchema;
export const deleteWorktreeResponseSchema = Schema.Struct({
  deleted: Schema.Boolean,
  plan: worktreeCleanupPlanSchema,
});
export type DeleteWorktreeRequest = typeof deleteWorktreeRequestSchema.Type;
export type DeleteWorktreeResponse = typeof deleteWorktreeResponseSchema.Type;
export type {
  WorktreeCleanupPlan,
  WorktreeCleanupRequest,
} from '@porcelain/kernel/models';
