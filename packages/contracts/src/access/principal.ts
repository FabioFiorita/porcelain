import { Schema } from 'effect';

export const principalSchema = Schema.Union([
  Schema.Struct({ kind: Schema.Literal('owner') }),
  Schema.Struct({
    kind: Schema.Literal('device'),
    deviceId: Schema.String.check(Schema.isUUID()),
  }),
]);

export type Principal = typeof principalSchema.Type;

export const readSessionResponseSchema = principalSchema;

export type ReadSessionRequest = { viewer: Principal };
export type ReadSessionResponse = typeof readSessionResponseSchema.Type;
