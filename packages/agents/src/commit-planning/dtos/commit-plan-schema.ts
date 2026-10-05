import { Schema } from 'effect';
import type { CommitPlanLimits } from './agent-limits.ts';

export function commitPlanSchema(limits: CommitPlanLimits) {
  return Schema.Struct({
    groups: Schema.Array(
      Schema.Struct({
        message: Schema.String.check(
          Schema.isMinLength(1),
          Schema.isMaxLength(limits.maxMessageLength),
        ),
        paths: Schema.Array(
          Schema.String.check(
            Schema.isMinLength(1),
            Schema.isMaxLength(limits.maxPathLength),
          ),
        ).check(Schema.isMinLength(1), Schema.isMaxLength(limits.maxPaths)),
      }),
    ).check(Schema.isMinLength(1), Schema.isMaxLength(limits.maxGroups)),
  });
}
