import type { Limits } from './limits.ts';

export function operationDeadlineMs(
  projectCount: number,
  limits: Pick<Limits, 'inventory' | 'lanes'>,
): number {
  return (
    Math.ceil(Math.max(projectCount, 1) / limits.inventory.listingLaunches) *
      limits.inventory.listingTimeoutMs +
    limits.lanes.operationTimeoutMs
  );
}
