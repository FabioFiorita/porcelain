import { z } from 'zod';

// Paths use canonical slash-separated relative spelling on every client platform.
export const preferencePathSchema = z
  .string()
  .min(1)
  .refine(
    (path) =>
      !path.includes('\\') &&
      !path.includes('\0') &&
      !path.includes(':') &&
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
  worktreeId: z.uuid(),
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
