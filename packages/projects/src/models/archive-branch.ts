import { Schema } from 'effect';
import {
  worktreeCleanupPlanSchema,
  worktreeCleanupRequestSchema,
} from '@porcelain/kernel/models';
export const archivePullRequestRequestSchema = worktreeCleanupRequestSchema;
export type ArchivePullRequestRequest =
  typeof archivePullRequestRequestSchema.Type;
export const archivePullRequestResponseSchema = Schema.Struct({
  archived: Schema.Boolean,
  plan: worktreeCleanupPlanSchema,
});
export type ArchivePullRequestResponse =
  typeof archivePullRequestResponseSchema.Type;
export type BranchArchiveTarget = ArchivePullRequestRequest & {
  commonDirectory: string;
  repositoryIdentity: string;
  worktreePath?: string | undefined;
  branch: string;
  mergedHead?: string | undefined;
  pullRequestHead: { repository: string | undefined; oid: string };
};
