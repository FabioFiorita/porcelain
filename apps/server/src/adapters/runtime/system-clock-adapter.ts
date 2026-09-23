export class SystemClockAdapter {
  private readonly read: () => string;

  constructor(read: () => string = () => new Date().toISOString()) {
    this.read = read;
  }

  now(): string {
    return this.read();
  }
}
