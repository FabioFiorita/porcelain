import { urlStringSchema } from '@porcelain/contracts/shared';
import { Schema } from 'effect';
export const serverMessage = Schema.Union([
  Schema.Struct({
    kind: Schema.Literal('ready'),
    address: urlStringSchema,
  }),
  Schema.Struct({
    kind: Schema.Literal('failed'),
    message: Schema.String,
  }),
]);
export const hostMessage = Schema.Union([
  Schema.Struct({
    kind: Schema.Literal('start'),
    profile: Schema.String,
    outputEnd: Schema.String.check(Schema.isUUID()),
    projectHome: Schema.String,
    packageRoot: Schema.String,
    version: Schema.String,
    session: Schema.Struct({
      deviceId: Schema.String,
      secretHash: Schema.String,
    }),
  }),
  Schema.Struct({
    kind: Schema.Literal('stop'),
  }),
  Schema.Struct({
    kind: Schema.Literal('exit'),
  }),
]);
