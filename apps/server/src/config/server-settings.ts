import { z } from 'zod';

export const serverSettingsSchema = z.object({
  token: z
    .string()
    .min(32)
    .regex(/^[A-Za-z0-9._~-]+$/),
});
