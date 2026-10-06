import { Schema } from 'effect';
import { projectIdSchema, worktreeIdSchema } from '@porcelain/contracts/shared';

export const projectSelectionSnapshotSchema = Schema.Struct({
  currentEnvironmentId: Schema.optional(projectIdSchema),
  selections: Schema.Record(
    Schema.String,
    Schema.Struct({ projectId: projectIdSchema, worktreeId: worktreeIdSchema }),
  ).check(Schema.isPropertyNames(projectIdSchema)),
});
