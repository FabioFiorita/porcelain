import { Schema } from 'effect';
import { worktreeIdSchema } from '../shared/schema.ts';
import { PATH_LENGTH } from '../shared/limits.ts';

const findWorktreeByPathRequestSchema = Schema.Struct({
  path: Schema.String.check(Schema.isMinLength(1)).check(
    Schema.isMaxLength(PATH_LENGTH),
  ),
});
const findWorktreeByPathResponseSchema = Schema.Struct({
  worktreeId: worktreeIdSchema,
});

export type FindWorktreeByPathRequest =
  typeof findWorktreeByPathRequestSchema.Type;
export type FindWorktreeByPathResponse =
  typeof findWorktreeByPathResponseSchema.Type;
