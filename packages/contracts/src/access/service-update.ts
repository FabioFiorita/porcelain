import { z } from 'zod';
import type { Principal } from './principal.ts';
import { absentAsNull } from '../shared/absent-as-null.ts';
import { SERVICE_VERSION_LENGTH } from '../shared/limits.ts';

const serviceUpdateSchema = z.object({
  from: z.string(),
  target: z.string(),
  stage: z.enum([
    'downloading',
    'installing',
    'restarting',
    'updated',
    'failed',
  ]),
  reason: absentAsNull(z.string()),
});

export const readServiceUpdateResponseSchema = z.object({
  managed: z.boolean(),
  version: absentAsNull(z.string()),
  latest: absentAsNull(z.string()),
  available: z.boolean(),
  running: z.boolean(),
  last: absentAsNull(serviceUpdateSchema),
  canUpdate: z.boolean(),
});

export const startServiceUpdateRequestSchema = z.strictObject({
  version: z.string().min(1).max(SERVICE_VERSION_LENGTH),
});

export const startServiceUpdateResponseSchema = readServiceUpdateResponseSchema;

export type ReadServiceUpdateRequest = { viewer: Principal; local: boolean };
export type ReadServiceUpdateResponse = z.output<
  typeof readServiceUpdateResponseSchema
>;
type StartServiceUpdateRequest = z.output<
  typeof startServiceUpdateRequestSchema
>;
export type StartServiceUpdateInput = StartServiceUpdateRequest &
  ReadServiceUpdateRequest;
export type StartServiceUpdateResponse = z.output<
  typeof startServiceUpdateResponseSchema
>;
