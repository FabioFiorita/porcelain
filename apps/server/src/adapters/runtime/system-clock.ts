import type { Clock } from '@porcelain/kernel/ports';

export class SystemClock implements Clock {
  private readonly read: () => string;

  constructor(read: () => string = () => new Date().toISOString()) {
    this.read = read;
  }

  now(): string {
    return this.read();
  }
}
