import { z } from 'zod';

// Paths use canonical slash-separated relative spelling on every client platform.
export const preferencePathSchema = z
  .string()
  .min(1)
  .max(4096)
  .refine(
    (path) =>
      !path.includes('\\') &&
      !path.includes('\0') &&
      !/^[A-Za-z]:/.test(path) &&
      path
        .split('/')
        .every(
          (part) =>
            part !== '' &&
            part !== '.' &&
            part !== '..' &&
            part.toLowerCase() !== '.git',
        ),
  );
export const filePreferenceScopeSchema = z.strictObject({
  projectId: z.uuid(),
});
export const setFilePreferenceRequestSchema = z.strictObject({
  path: preferencePathSchema,
  flag: z.enum(['pinned', 'hidden']),
  value: z.boolean(),
});
export const filePreferenceSchema = z.object({
  path: preferencePathSchema,
  pinned: z.boolean(),
  hidden: z.boolean(),
});
export const filePreferencesResponseSchema = z.object({
  preferences: z.array(filePreferenceSchema),
});
