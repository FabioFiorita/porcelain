import type { TunnelAnswer, TunnelTarget } from '@porcelain/access/models';
import type { TunnelProbe } from '@porcelain/access/ports';

export class ScriptedTunnelProbe implements TunnelProbe {
  private readonly answer: (target: TunnelTarget) => Promise<TunnelAnswer>;

  constructor(answer: (target: TunnelTarget) => Promise<TunnelAnswer>) {
    this.answer = answer;
  }

  probe(input: TunnelTarget): Promise<TunnelAnswer> {
    return this.answer(input);
  }
}
