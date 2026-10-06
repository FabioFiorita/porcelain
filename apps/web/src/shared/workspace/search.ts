import { Effect, Option, Schema } from 'effect';
import { WORKSPACE_SEARCH_VALUE_MAX_LENGTH } from '@/config/limits';

const surfaceSchema = Schema.Literals(['changes', 'files', 'history']);
const changeScopeSchema = Schema.Literals(['uncommitted', 'branch']);
const searchValueSchema = Schema.optional(
  Schema.String.check(Schema.isMaxLength(WORKSPACE_SEARCH_VALUE_MAX_LENGTH)),
).pipe(Schema.catchDecoding(() => Effect.succeed(Option.some(undefined))));

export const workspaceSearchSchema = Schema.Struct({
  surface: Schema.optional(surfaceSchema).pipe(
    Schema.catchDecoding(() => Effect.succeed(Option.some(undefined))),
  ),
  entry: searchValueSchema,
  side: searchValueSchema,
  scope: Schema.optional(changeScopeSchema).pipe(
    Schema.catchDecoding(() => Effect.succeed(Option.some(undefined))),
  ),
  base: searchValueSchema,
});

export type Surface = typeof surfaceSchema.Type;
export type ChangeScope = typeof changeScopeSchema.Type;
export type WorkspaceSearch = typeof workspaceSearchSchema.Type;
export type SetWorkspaceSearch = (
  update: Partial<WorkspaceSearch>,
  options?: { replace: boolean },
) => void;

export const isSurface: (value: unknown) => value is Surface =
  Schema.is(surfaceSchema);
export const isChangeScope: (value: unknown) => value is ChangeScope =
  Schema.is(changeScopeSchema);
