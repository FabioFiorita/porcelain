import type { Clock } from '../../src/ports/clock.ts';

export class FixedClock implements Clock {
  private instant: string;

  constructor(instant = '2026-01-01T00:00:00.000Z') {
    this.instant = instant;
  }

  now(): string {
    return this.instant;
  }

  set(instant: string): void {
    this.instant = instant;
  }

  advance(milliseconds: number): void {
    this.instant = new Date(
      Date.parse(this.instant) + milliseconds,
    ).toISOString();
  }
}
