import { Schema } from 'effect';
export const gitActionResultSchema = Schema.Struct({
  headOid: Schema.mutableKey(
    Schema.optional(Schema.Union([Schema.String, Schema.Undefined])),
  ),
  trackingOid: Schema.mutableKey(
    Schema.optional(Schema.Union([Schema.String, Schema.Undefined])),
  ),
  sourceOid: Schema.mutableKey(
    Schema.optional(Schema.Union([Schema.String, Schema.Undefined])),
  ),
  destinationRef: Schema.mutableKey(
    Schema.optional(Schema.Union([Schema.String, Schema.Undefined])),
  ),
  stashOid: Schema.mutableKey(
    Schema.optional(Schema.Union([Schema.String, Schema.Undefined])),
  ),
  stashRetained: Schema.mutableKey(
    Schema.optional(Schema.Union([Schema.Boolean, Schema.Undefined])),
  ),
  restoreStashOid: Schema.mutableKey(
    Schema.optional(Schema.Union([Schema.String, Schema.Undefined])),
  ),
  restoreIndex: Schema.mutableKey(
    Schema.optional(Schema.Union([Schema.Boolean, Schema.Undefined])),
  ),
  branch: Schema.mutableKey(
    Schema.optional(Schema.Union([Schema.String, Schema.Undefined])),
  ),
});

import type { GitActionReason } from './git-action-reason.ts';

export type GitActionResult = typeof gitActionResultSchema.Type;

export type GitActionOutcome = {
  state:
    | 'succeeded'
    | 'no-change'
    | 'rejected'
    | 'conflicted'
    | 'indeterminate'
    | 'interrupted';
  reason?: GitActionReason | undefined;
  message?: string | undefined;
  result?: GitActionResult | undefined;
  refreshRequired: boolean;
};
