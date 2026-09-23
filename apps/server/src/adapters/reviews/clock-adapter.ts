import type { Clock } from '@porcelain/reviews/ports';

export class ClockAdapter implements Clock {
  private readonly read: () => string;

  constructor(read: () => string = () => new Date().toISOString()) {
    this.read = read;
  }

  now(): string {
    return this.read();
  }
}
