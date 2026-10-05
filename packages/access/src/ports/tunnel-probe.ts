import { Context } from 'effect';
import type { Effect } from 'effect';
import type { TunnelAnswer, TunnelTarget } from '../models/remote-access.ts';

export interface TunnelProbe {
  probe(input: TunnelTarget): Effect.Effect<TunnelAnswer>;
}

export const TunnelProbe = Context.Service<
  '@porcelain/access/TunnelProbe',
  TunnelProbe
>('@porcelain/access/TunnelProbe');
