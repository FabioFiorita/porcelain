import { z } from 'zod';

const maximumTimerDelayMs = 2_147_483_647;

export const applicationSettingsSchema = z.object({
  operationTimeoutMs: z
    .number()
    .int()
    .min(1)
    .max(maximumTimerDelayMs)
    .default(30_000),
  projectListingTimeoutMs: z
    .number()
    .int()
    .min(1)
    .max(maximumTimerDelayMs)
    .default(5_000),
});
