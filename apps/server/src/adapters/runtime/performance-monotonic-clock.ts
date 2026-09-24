import { performance } from 'node:perf_hooks';
import type { MonotonicClock } from '../../ports/monotonic-clock.ts';

export class PerformanceMonotonicClock implements MonotonicClock {
  elapsedMs(): number {
    return performance.now();
  }
}
