import { Layer, type Effect } from 'effect';
import { nativeOperation } from '@porcelain/effects';
import type { TunnelAnswer, TunnelTarget } from '@porcelain/access/models';
import { TunnelProbe } from '@porcelain/access/ports';

export class ScriptedTunnelProbe implements TunnelProbe {
  readonly layer = Layer.succeed(TunnelProbe, this);

  private readonly answer: (target: TunnelTarget) => Promise<TunnelAnswer>;

  constructor(answer: (target: TunnelTarget) => Promise<TunnelAnswer>) {
    this.answer = answer;
  }

  probe(input: TunnelTarget): Effect.Effect<TunnelAnswer> {
    return nativeOperation(() => this.answer(input));
  }
}
