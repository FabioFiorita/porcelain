import type { RouteState, TailnetProxy } from '../models/remote-access.ts';
import { canonicalHostname } from './host-policy.ts';

export type Arrival = {
  localAddress: string | undefined;
  localPort: number | undefined;
};

export function tailnetNeedsCheck(state: RouteState): boolean {
  return state.kind !== 'on';
}

export function tailnetShownWhileChecking(current: RouteState): RouteState {
  const answered =
    current.kind === 'on' ||
    (current.kind === 'failed' &&
      (current.reason === 'unreachable' || current.reason === 'other-server'));
  return answered ? current : { kind: 'starting' };
}

export function arrivedThroughTailnet(
  arrival: Arrival,
  proxy: TailnetProxy | undefined,
): boolean {
  const local =
    arrival.localAddress === undefined
      ? undefined
      : canonicalHostname(arrival.localAddress);
  return (
    proxy !== undefined &&
    local !== undefined &&
    local === canonicalHostname(proxy.address) &&
    arrival.localPort === proxy.port
  );
}

export function tailnetTarget(address: string, port: number): string {
  return `http://${address}:${port}`;
}
