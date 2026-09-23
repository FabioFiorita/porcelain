import type { Clock } from '@porcelain/projects/ports';

export class SystemClockAdapter implements Clock {
  now(): string {
    return new Date().toISOString();
  }
}
