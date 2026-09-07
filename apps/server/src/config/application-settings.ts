import { z } from 'zod';

// Node timers use a signed 32-bit millisecond delay.
const maximumTimerDelayMs = 2_147_483_647;

export const applicationSettingsSchema = z.object({
  operationTimeoutMs: z
    .number()
    .int()
    .min(1)
    .max(maximumTimerDelayMs)
    .default(30_000),
});
