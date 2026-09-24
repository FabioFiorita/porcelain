import { z } from 'zod';
import { relativePathSchema } from '../shared/relative-path.ts';

const filePreferenceSchema = z.object({
  path: relativePathSchema,
  pinned: z.boolean(),
  hidden: z.boolean(),
});

export const listFilePreferencesResponseSchema = z.object({
  preferences: z.array(filePreferenceSchema),
});

export const setFilePreferenceRequestSchema = z.strictObject({
  path: relativePathSchema,
  flag: z.enum(['pinned', 'hidden']),
  value: z.boolean(),
});
export const setFilePreferenceResponseSchema =
  listFilePreferencesResponseSchema;

export type ListFilePreferencesResponse = z.output<
  typeof listFilePreferencesResponseSchema
>;
export type SetFilePreferenceRequest = z.output<
  typeof setFilePreferenceRequestSchema
>;
export type SetFilePreferenceResponse = z.output<
  typeof setFilePreferenceResponseSchema
>;
