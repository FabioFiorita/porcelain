import { Schema } from 'effect';
import type { Principal } from './principal.ts';
import { nullableAsUndefined } from '../shared/schema.ts';
import { SERVICE_VERSION_LENGTH } from '../shared/limits.ts';

const serviceUpdateSchema = Schema.Struct({
  from: Schema.String,
  target: Schema.String,
  stage: Schema.Literals([
    'downloading',
    'installing',
    'restarting',
    'updated',
    'failed',
  ]),
  reason: nullableAsUndefined(Schema.String),
});

export const readServiceUpdateResponseSchema = Schema.Struct({
  managed: Schema.Boolean,
  version: nullableAsUndefined(Schema.String),
  latest: nullableAsUndefined(Schema.String),
  available: Schema.Boolean,
  running: Schema.Boolean,
  last: nullableAsUndefined(serviceUpdateSchema),
  canUpdate: Schema.Boolean,
});

export const startServiceUpdateRequestSchema = Schema.Struct({
  version: Schema.String.check(Schema.isMinLength(1)).check(
    Schema.isMaxLength(SERVICE_VERSION_LENGTH),
  ),
});

export const startServiceUpdateResponseSchema = readServiceUpdateResponseSchema;

export type ReadServiceUpdateRequest = { viewer: Principal; local: boolean };
export type ReadServiceUpdateResponse =
  typeof readServiceUpdateResponseSchema.Type;
type StartServiceUpdateRequest = typeof startServiceUpdateRequestSchema.Type;
export type StartServiceUpdateInput = StartServiceUpdateRequest &
  ReadServiceUpdateRequest;
export type StartServiceUpdateResponse =
  typeof startServiceUpdateResponseSchema.Type;
