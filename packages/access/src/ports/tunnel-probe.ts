import type { Effect } from 'effect';
import type { TunnelAnswer, TunnelTarget } from '../models/remote-access.ts';

export interface TunnelProbe {
  probe(input: TunnelTarget): Effect.Effect<TunnelAnswer>;
}
