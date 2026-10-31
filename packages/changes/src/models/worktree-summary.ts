import { Schema } from 'effect';
export const worktreeSummarySchema = Schema.Struct({
  additions: Schema.Int,
  deletions: Schema.Int,
  binaryFiles: Schema.Int,
});
export type WorktreeSummary = typeof worktreeSummarySchema.Type;
