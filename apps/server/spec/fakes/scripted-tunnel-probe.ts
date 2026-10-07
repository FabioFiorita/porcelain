import { Layer, type Effect } from 'effect';
import type { TunnelAnswer, TunnelTarget } from '@porcelain/access/models';
import { TunnelProbe } from '@porcelain/access/ports';

export class ScriptedTunnelProbe implements TunnelProbe {
  readonly layer = Layer.succeed(TunnelProbe, this);

  private readonly answer: (
    target: TunnelTarget,
  ) => Effect.Effect<TunnelAnswer>;

  constructor(answer: (target: TunnelTarget) => Effect.Effect<TunnelAnswer>) {
    this.answer = answer;
  }

  probe(input: TunnelTarget): Effect.Effect<TunnelAnswer> {
    return this.answer(input);
  }
}
