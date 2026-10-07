import { type Effect, Context } from 'effect';
import type { OwnerStatus } from '@porcelain/kernel/models';

export type OwnerProbeRequest = { socketPath: string; timeoutMs: number };

export type OwnerProbeResult =
  | { kind: 'running'; status: OwnerStatus }
  | { kind: 'absent' }
  | { kind: 'unreadable'; reason: string };

export interface OwnerProbe {
  probe(input: OwnerProbeRequest): Effect.Effect<OwnerProbeResult>;
}

export const OwnerProbe = Context.Service<
  '@porcelain/server/OwnerProbe',
  OwnerProbe
>('@porcelain/server/OwnerProbe');
