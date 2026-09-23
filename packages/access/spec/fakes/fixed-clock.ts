import type { Clock } from '../../src/ports/clock.ts';

export class FixedClock implements Clock {
  at: string;

  constructor(at: string) {
    this.at = at;
  }

  now(): string {
    return this.at;
  }

  advance(milliseconds: number): void {
    this.at = new Date(Date.parse(this.at) + milliseconds).toISOString();
  }
}
