import { z } from 'zod';

const maximumTimerDelayMs = 2_147_483_647;
const listingLaunches = 4;

const timerDelay = (defaultMs: number) =>
  z.number().int().min(1).max(maximumTimerDelayMs).default(defaultMs);

export const applicationSettingsSchema = z.object({
  operationTimeoutMs: timerDelay(30_000),
  projectListingTimeoutMs: timerDelay(5_000),
  gitActionDeadlineMs: timerDelay(120_000),
  commitModelDeadlineMs: timerDelay(120_000),
});

export type ApplicationSettings = z.output<typeof applicationSettingsSchema>;

export function operationDeadlineMs(
  projectCount: number,
  settings: Pick<
    ApplicationSettings,
    'operationTimeoutMs' | 'projectListingTimeoutMs'
  >,
): number {
  return (
    Math.ceil(Math.max(projectCount, 1) / listingLaunches) *
      settings.projectListingTimeoutMs +
    settings.operationTimeoutMs
  );
}
