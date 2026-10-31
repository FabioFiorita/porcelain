import { Schema } from 'effect';
import {
  worktreeCleanupPlanSchema,
  worktreeCleanupRequestSchema,
} from '@porcelain/kernel/models';
export type ReviewArchivePlan = typeof worktreeCleanupPlanSchema.Type;
export const archiveReviewRequestSchema = worktreeCleanupRequestSchema;
export type ArchiveReviewRequest = typeof archiveReviewRequestSchema.Type;
export const archiveReviewResponseSchema = Schema.Struct({
  archived: Schema.Boolean,
  plan: worktreeCleanupPlanSchema,
});
export type ReviewArchiveTarget = ArchiveReviewRequest & {
  commonDirectory: string;
  repositoryIdentity: string;
  worktreePath: string;
  branch: string;
  mergedHead?: string | undefined;
};
