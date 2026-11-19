import { createFileRoute } from '@tanstack/react-router';
import { Effect, Option, Schema } from 'effect';
import { workspaceSearchSchema } from '@/shared/workspace/search';

export const Route = createFileRoute('/_paired/')({
  validateSearch: Schema.decodeUnknownSync(
    Schema.Struct({
      ...workspaceSearchSchema.fields,
      worktree: Schema.optional(Schema.String).pipe(
        Schema.catchDecoding(() => Effect.succeed(Option.some(undefined))),
      ),
    }),
  ),
});
