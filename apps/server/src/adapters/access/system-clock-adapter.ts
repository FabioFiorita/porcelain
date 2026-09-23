import type { Clock } from '@porcelain/access/ports';

export class SystemClockAdapter implements Clock {
  now(): string {
    return new Date().toISOString();
  }
}
