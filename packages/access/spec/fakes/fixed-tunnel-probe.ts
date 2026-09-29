import type { TunnelAnswer } from '../../src/models/remote-access.ts';
import type { TunnelProbe } from '../../src/ports/tunnel-probe.ts';

export class FixedTunnelProbe implements TunnelProbe {
  private answer: TunnelAnswer;

  constructor(answer: TunnelAnswer) {
    this.answer = answer;
  }

  async probe(): Promise<TunnelAnswer> {
    return this.answer;
  }

  replace(answer: TunnelAnswer): void {
    this.answer = answer;
  }
}
