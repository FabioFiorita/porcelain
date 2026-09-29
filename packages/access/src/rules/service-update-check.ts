import { instantAfter } from '@porcelain/kernel/rules';
import type { ServiceUpdateCheck } from '../models/service-update.ts';

export function serviceUpdateCheck(
  now: string,
  latestVersionTtlMs: number,
): ServiceUpdateCheck {
  return { now, staleBefore: instantAfter(now, -latestVersionTtlMs) };
}
