import type { HeldConnection } from '../../src/ports/device-connection-store.ts';

export class RecordingHeldConnection implements HeldConnection {
  private closes = 0;

  close(): void {
    this.closes += 1;
  }

  timesClosed(): number {
    return this.closes;
  }
}
