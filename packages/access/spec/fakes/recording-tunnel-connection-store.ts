import type { TunnelHostnames } from '../../src/models/remote-access.ts';
import type { TunnelConnectionStore } from '../../src/ports/tunnel-connection-store.ts';

export class RecordingTunnelConnectionStore implements TunnelConnectionStore {
  private readonly calls: string[][] = [];

  retain(input: TunnelHostnames): void {
    this.calls.push([...input.hostnames]);
  }

  retained(): string[][] {
    return this.calls.map((hostnames) => [...hostnames]);
  }
}
