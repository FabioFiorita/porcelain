import type { Clock } from '@porcelain/kernel/ports';
import type { ServiceUpdateCheck } from '../models/service-update.ts';
import { serviceUpdateCheck } from '../rules/service-update-check.ts';

export class PlanServiceUpdateCheckService {
  private readonly clock: Clock;
  private readonly latestVersionTtlMs: number;

  constructor(clock: Clock, options: { latestVersionTtlMs: number }) {
    this.clock = clock;
    this.latestVersionTtlMs = options.latestVersionTtlMs;
  }

  execute(): ServiceUpdateCheck {
    return serviceUpdateCheck(this.clock.now(), this.latestVersionTtlMs);
  }
}
