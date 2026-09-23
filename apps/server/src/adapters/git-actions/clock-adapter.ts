import type { Clock } from '@porcelain/git-actions/ports';

export class ClockAdapter implements Clock {
  now(): string {
    return new Date().toISOString();
  }
}
