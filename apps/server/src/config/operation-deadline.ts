import { Duration } from 'effect';
import type { Limits } from './limits.ts';

export function operationDeadline(
  projectCount: number,
  limits: Pick<Limits, 'inventory' | 'lanes'>,
): Duration.Duration {
  return Duration.sum(
    Duration.times(
      limits.inventory.listingTimeout,
      Math.ceil(Math.max(projectCount, 1) / limits.inventory.listingLaunches),
    ),
    limits.lanes.operationTimeout,
  );
}
