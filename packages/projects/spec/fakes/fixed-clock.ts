import type { Clock } from '@porcelain/projects/ports';

export class FixedClock implements Clock {
  private current: string;

  constructor(current: string) {
    this.current = current;
  }

  now(): string {
    return this.current;
  }

  set(current: string): void {
    this.current = current;
  }
}
