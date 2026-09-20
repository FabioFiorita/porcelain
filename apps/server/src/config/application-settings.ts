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
  /**
   * How long one project may take to list before it is reported unavailable.
   * Git's own read deadline is ten seconds, which is far longer than anyone
   * waits for a sidebar, and an unresponsive mount takes all of it.
   */
  projectListingTimeoutMs: z
    .number()
    .int()
    .min(1)
    .max(maximumTimerDelayMs)
    .default(5_000),
});
