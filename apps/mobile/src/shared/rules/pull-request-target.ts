import * as Schema from 'effect/Schema';

export const pullRequestTargetSchema = Schema.Struct({
  environmentId: Schema.String,
  projectId: Schema.String,

  number: Schema.Int.check(Schema.isGreaterThanOrEqualTo(1)),
});
export type PullRequestTarget = typeof pullRequestTargetSchema.Type;
