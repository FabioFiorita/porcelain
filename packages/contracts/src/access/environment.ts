import { z } from 'zod';
import { absentAsNull } from '../shared/absent-as-null.ts';
import { environmentSchema } from '../shared/environment.ts';
import { ENVIRONMENT_NAME_LENGTH } from '../shared/limits.ts';

export const readEnvironmentResponseSchema = z.object({
  environmentId: z.string(),
  name: z.string(),
  version: absentAsNull(z.string()),
  protocol: z.number().int().positive(),
});

export const renameEnvironmentRequestSchema = z.strictObject({
  name: z
    .string()
    .trim()
    .min(1)
    .max(ENVIRONMENT_NAME_LENGTH)
    .refine((name) => !/\p{Cc}/u.test(name))
    .nullable(),
});

export const renameEnvironmentResponseSchema = environmentSchema;

export type ReadEnvironmentResponse = z.output<
  typeof readEnvironmentResponseSchema
>;
export type RenameEnvironmentRequest = z.output<
  typeof renameEnvironmentRequestSchema
>;
export type RenameEnvironmentResponse = z.output<
  typeof renameEnvironmentResponseSchema
>;
