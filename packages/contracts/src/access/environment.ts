import { z } from 'zod';
import { environmentSchema } from '../shared/environment.ts';
import { ENVIRONMENT_NAME_LENGTH } from '../shared/limits.ts';

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

export type RenameEnvironmentRequest = z.output<
  typeof renameEnvironmentRequestSchema
>;
export type RenameEnvironmentResponse = z.output<
  typeof renameEnvironmentResponseSchema
>;
