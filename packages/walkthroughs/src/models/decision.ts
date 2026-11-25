import { Schema } from 'effect';

export const callDeciderSchema = Schema.Union([
  Schema.Struct({ kind: Schema.Literal('owner') }),
  Schema.Struct({ kind: Schema.Literal('device'), deviceId: Schema.String }),
]);
export const callDecisionSchema = Schema.Struct({
  step: Schema.Int,
  call: Schema.Int,
  option: Schema.optional(Schema.String),
  decidedBy: callDeciderSchema,
  decidedAt: Schema.String,
});
export type CallDecider = typeof callDeciderSchema.Type;
export type CallDecision = typeof callDecisionSchema.Type;
export type CallTarget = {
  readonly worktreeId: string;
  readonly runId: string;
  readonly step: number;
  readonly call: number;
};
