import type { TunnelAnswer, TunnelTarget } from '../models/remote-access.ts';

export interface TunnelProbe {
  probe(input: TunnelTarget, signal?: AbortSignal): Promise<TunnelAnswer>;
}
