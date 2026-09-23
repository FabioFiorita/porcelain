import type { Clock } from '../../src/ports/index.ts';

export class FixedClock implements Clock {
  private instant: string;

  constructor(instant: string) {
    this.instant = instant;
  }

  now(): string {
    return this.instant;
  }

  set(instant: string): void {
    this.instant = instant;
  }
}
