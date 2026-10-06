import { type Effect, Schema } from 'effect';
import { gitActionExpectationSchema } from './git-action-expectation.ts';
import { gitActionIntentSchema } from './git-action-intent.ts';
import type { GitActionOutcome } from './git-action-outcome.ts';
import type { GitActionReason } from './git-action-reason.ts';

const gitActionTargetSchema = Schema.Union([
  Schema.Struct({ kind: Schema.mutableKey(Schema.Literal('unchecked')) }),
  Schema.Struct({
    kind: Schema.mutableKey(Schema.Literal('checked')),
    paths: Schema.mutableKey(
      Schema.Union([
        Schema.mutable(Schema.Array(Schema.String)),
        Schema.Undefined,
      ]),
    ),
  }),
]);
export type GitActionTarget = typeof gitActionTargetSchema.Type;

export const gitActionRunSchema = Schema.Struct({
  requestId: Schema.mutableKey(Schema.String),
  projectId: Schema.mutableKey(Schema.String),
  worktreeId: Schema.mutableKey(Schema.String),
  intent: Schema.mutableKey(gitActionIntentSchema),
  expected: Schema.mutableKey(gitActionExpectationSchema),
  target: Schema.mutableKey(gitActionTargetSchema),
});
export type GitActionRun = typeof gitActionRunSchema.Type;

export type GitActionProgressListener = (line: string) => Effect.Effect<void>;

export type GitActionRunRequest = {
  run: GitActionRun;
  onProgress?: GitActionProgressListener | undefined;
};

export type GitActionRunnerOutcome =
  | { kind: 'finished'; outcome: GitActionOutcome }
  | { kind: 'refused'; reason: GitActionReason; detail: string | undefined }
  | { kind: 'timed-out' };
