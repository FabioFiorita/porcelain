import * as Schema from 'effect/Schema';

export const liveDiagnosticSchema = Schema.Struct({
  at: Schema.Int,
  event: Schema.Literals([
    'Connection attempt',
    'Server ready',
    'Connected',
    'Retry scheduled',
    'Retry requested',
    'Socket closed',
    'Socket error',
    'Liveness timeout',
    'Ready timeout',
    'Follow timeout',
    'Connection setup timeout',
    'Connection setup failed',
    'Access refused',
    'Connection route changed',
    'Suspended',
    'Resumed',
    'Refreshed in place',
  ]),
  code: Schema.optional(Schema.Int),
  reason: Schema.optional(
    Schema.Literals(['Device access revoked', 'Reason withheld']),
  ),
  retryMs: Schema.optional(Schema.Int),
});

export type LiveDiagnostic = typeof liveDiagnosticSchema.Type;
